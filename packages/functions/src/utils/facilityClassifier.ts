import { GoogleGenerativeAI } from '@google/generative-ai';
import { inferFacilityType, type FacilityType } from '@xiri/shared';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FACILITY_KEYWORDS: Array<{ facilityType: FacilityType; keywords: string[] }> = [
    { facilityType: 'medical_dental', keywords: ['dentist', 'dental', 'orthodont', 'endodont', 'oral surgery', 'periodont'] },
    { facilityType: 'medical_urgent_care', keywords: ['urgent care', 'walk-in clinic', 'walk in clinic'] },
    { facilityType: 'medical_surgery', keywords: ['surgery center', 'surgical center', 'outpatient surgery', 'ambulatory surgery'] },
    { facilityType: 'medical_dialysis', keywords: ['dialysis'] },
    { facilityType: 'medical_veterinary', keywords: ['veterinary', 'animal hospital', 'vet clinic', 'pet hospital'] },
    { facilityType: 'medical_physical_therapy', keywords: ['physical therapy', 'physiotherapy', 'rehabilitation', 'rehab', 'pt clinic'] },
    { facilityType: 'medical_private', keywords: ['medical office', 'physician', 'doctor', 'family medicine', 'internal medicine', 'dermatology', 'pediatrics', 'optometry', 'eye care', 'allergy'] },
    { facilityType: 'edu_daycare', keywords: ['daycare', 'childcare', 'preschool', 'nursery school'] },
    { facilityType: 'edu_tutoring', keywords: ['tutoring', 'learning center', 'test prep', 'kumon', 'mathnasium', 'sylvan'] },
    { facilityType: 'edu_private_school', keywords: ['private school', 'academy', 'head of school', 'montessori', 'prep school'] },
    { facilityType: 'auto_dealer_showroom', keywords: ['dealership', 'dealer', 'new inventory', 'used inventory', 'schedule test drive'] },
    { facilityType: 'auto_service_center', keywords: ['auto repair', 'collision', 'mechanic', 'oil change', 'brake service', 'tire service'] },
    { facilityType: 'lab_cleanroom', keywords: ['cleanroom', 'laboratory', 'analytical lab', 'testing lab'] },
    { facilityType: 'lab_bsl', keywords: ['biosafety', 'bsl-2', 'bsl2', 'bsl-3', 'bsl3'] },
    { facilityType: 'manufacturing_light', keywords: ['warehouse', 'manufacturing', 'distribution center', 'plant'] },
    { facilityType: 'fitness_gym', keywords: ['fitness center', 'gym', 'crossfit', 'pilates', 'yoga studio', 'personal training'] },
    { facilityType: 'retail_storefront', keywords: ['shop now', 'our store', 'boutique', 'retail', 'showroom'] },
    { facilityType: 'religious_center', keywords: ['church', 'synagogue', 'mosque', 'temple', 'worship'] },
    { facilityType: 'funeral_home', keywords: ['funeral home', 'memorial chapel', 'cremation', 'mortuary'] },
    { facilityType: 'office_general', keywords: ['law office', 'accounting firm', 'insurance agency', 'professional office', 'office suite'] },
];

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreHeuristic(text: string): Array<{ facilityType: FacilityType; score: number }> {
    const haystack = text.toLowerCase();
    return FACILITY_KEYWORDS.map(({ facilityType, keywords }) => {
        let score = 0;
        for (const keyword of keywords) {
            if (haystack.includes(keyword)) score += keyword.includes(' ') ? 3 : 2;
        }
        return { facilityType, score };
    }).sort((a, b) => b.score - a.score);
}

function shouldEscalateToLlm(scores: Array<{ facilityType: FacilityType; score: number }>, heuristic?: FacilityType | null): boolean {
    const top = scores[0];
    const second = scores[1];
    if (!top || top.score === 0) return true;
    if (top.score >= 6 && (!second || top.score - second.score >= 3)) return false;
    if (heuristic && top.facilityType === heuristic && top.score >= 4) return false;
    return true;
}

async function classifyWithGemini(text: string, businessName: string, searchQuery: string, geminiApiKey: string): Promise<FacilityType | undefined> {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Classify this business into one canonical facility type for commercial cleaning outreach.

Allowed facility types only:
medical_dental, medical_private, medical_urgent_care, medical_surgery, medical_dialysis, medical_veterinary, medical_physical_therapy, edu_daycare, edu_tutoring, edu_private_school, auto_dealer_showroom, auto_service_center, lab_cleanroom, lab_bsl, manufacturing_light, fitness_gym, retail_storefront, religious_center, funeral_home, office_general, other

Rules:
- Use website evidence first.
- Use search query only as a weak tiebreaker.
- If still ambiguous, choose office_general or other.
- Return JSON only: {"facilityType":"one_allowed_value","reason":"short explanation"}

Business: ${businessName}
Search query: ${searchQuery}
Website text:
${text.slice(0, 12000)}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return undefined;
    const parsed = JSON.parse(jsonMatch[0]) as { facilityType?: string };
    const candidate = parsed.facilityType as FacilityType | undefined;
    return candidate;
}

export async function classifyFacilityType(
    url: string | undefined,
    businessName: string,
    searchQuery: string,
    geminiApiKey: string,
    log?: string[]
): Promise<FacilityType | undefined> {
    const heuristic = inferFacilityType(searchQuery);
    if (!url) return heuristic || undefined;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            log?.push(`Facility classifier: website fetch failed (${response.status}) — using heuristic`);
            return heuristic || undefined;
        }

        const html = await response.text();
        const text = stripHtml(html);
        if (!text) return heuristic || undefined;

        const scores = scoreHeuristic(text);
        const top = scores[0];
        const second = scores[1];
        if (!shouldEscalateToLlm(scores, heuristic)) {
            log?.push(`Facility classifier: heuristic match ${top.facilityType} (score ${top.score}${second ? ` vs ${second.score}` : ''})`);
            return top.facilityType;
        }

        log?.push(`Facility classifier: ambiguous heuristic${top ? ` (${top.facilityType}:${top.score})` : ''} — escalating to Gemini`);
        const llmType = await classifyWithGemini(text, businessName, searchQuery, geminiApiKey);
        if (llmType) {
            log?.push(`Facility classifier: Gemini chose ${llmType}`);
            return llmType;
        }
        return top?.facilityType || heuristic || undefined;
    } catch (error: any) {
        log?.push(`Facility classifier failed: ${error.message}`);
        return heuristic || undefined;
    }
}
