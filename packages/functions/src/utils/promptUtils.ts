/**
 * Shared utility for fetching AI prompts from Firestore.
 * All Gemini prompts live in the `prompts` collection.
 */

import { db } from './firebase';
import * as logger from 'firebase-functions/logger';
import { cleanBusinessName as sharedCleanBusinessName } from '@xiri/shared';

export async function getPrompt(
    promptId: string,
    fallback: string,
    variables?: Record<string, string>
): Promise<string> {
    try {
        const doc = await db.collection('prompts').doc(promptId).get();
        if (!doc.exists) {
            logger.warn(`[getPrompt] Prompt "${promptId}" not found in Firestore, using fallback.`);
            return applyVariables(fallback, variables);
        }
        const content = doc.data()?.content;
        if (!content) {
            logger.warn(`[getPrompt] Prompt "${promptId}" has no content field, using fallback.`);
            return applyVariables(fallback, variables);
        }
        return applyVariables(content, variables);
    } catch (err) {
        logger.error(`[getPrompt] Error fetching prompt "${promptId}":`, err);
        return applyVariables(fallback, variables);
    }
}

function applyVariables(content: string, variables?: Record<string, string>): string {
    if (!variables) return content;
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

// ══════════════════════════════════════════════════════════════════════
// DEFAULT SDR AGENT PROMPTS (Dental & Orthodontic — Metro NY ICP)
// ══════════════════════════════════════════════════════════════════════

export const DEFAULT_SDR_PROFILER_PROMPT = `You are an expert B2B SDR Intelligence Agent for XIRI Facility Solutions, specializing in Dental and Orthodontic practice intelligence across Metro New York.

Your task: Analyze the provided website content, search evidence, and practice metadata for a dental or orthodontic practice.
Evaluate its ICP fit, classify its exact specialty (especially whether it is an orthodontic practice vs. general/specialty dental), identify whether it is a private practice or corporate DSO, and find the best local decision-maker.

TARGET ICP CRITERIA:
- Private or partner-owned Dental or Orthodontic practice (General/Family, Orthodontics, Pediatric, Oral Surgery, Endodontics, Periodontics, Prosthodontics, Cosmetic)
- Physical clinic with 2+ operatories/chairs located in Long Island (Nassau/Suffolk), NYC 5 Boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island), Yonkers, or Westchester County
- Decision-Maker Priority:
  1. Office Manager, Practice Administrator, Practice Director, Treatment Coordinator / Operations Manager
  2. Lead Dental Assistant / Clinical Coordinator (if involved in facilities/OSHA)
  3. Owner / Partner Doctor (for solo or boutique practices)
- DISQUALIFY / REJECT (set icpScore < 30 and isDsoChain: true when applicable):
  - Corporate DSO chains with centralized procurement (Aspen Dental, Heartland, Pacific Dental, Tend, Dental365, ProHEALTH Dental, Great Expressions, ClearChoice, Smile Doctors, Western Dental)
  - Dental labs, dental supply vendors, hospital clinics, university clinics, or mobile-only services

WEBSITE & SEARCH CONTENT:
Business Name: {{businessName}}
Address: {{address}}
Website: {{website}}
Content:
{{websiteText}}

Return ONLY valid JSON with this exact schema:
{
  "clinicType": "general" | "ortho" | "pediatric" | "oral_surgery" | "periodontics" | "endodontics" | "prosthodontics" | "cosmetic" | "other",
  "isDsoChain": boolean,
  "dsoName": string | null,
  "estimatedOperatories": number,
  "doctorCount": number,
  "keyObservation": "1-2 concise, concrete sentences about their clinical focus (e.g. open-bay ortho clinic, Invisalign/iTero, pediatric family space, multi-doctor dental suite), doctors, or operational setup to personalize an email opening",
  "icpScore": number (0 to 100, >=75 is auto-enroll high fit),
  "decisionMaker": {
    "name": "full name of best decision maker or null",
    "title": "their exact title or null",
    "roleType": "office_manager" | "practice_administrator" | "owner_doctor" | "clinical_coordinator" | "unknown",
    "email": "personal direct email address if found, or null",
    "phone": "direct or office phone or null"
  },
  "genericEmail": "fallback info@ or office@ email if no personal email found, or null",
  "confidence": "high" | "medium" | "low",
  "qualificationReason": "brief explanation of why this practice fits or does not fit our ICP"
}`;

export const DEFAULT_SDR_COPYWRITER_PROMPT = `You are an elite B2B SDR Copywriter for XIRI Facility Solutions, writing Email #1 of an email marketing funnel to a private dental or orthodontic practice decision-maker in Metro NY (Long Island, NYC 5 Boroughs, Yonkers, or Westchester).

CORE VALUE PROPOSITION:
1. SPECIALIZED DENTAL & ORTHO PROTOCOLS: Chair-safe EPA List N disinfection (protects A-dec/Belmont Ultraleather upholstery), CaviWipe LVT haze removal, sterilization galley detailing, and (for orthodontic clinics) open-bay chair/iTero scanner protection and spotless teen/parent waiting areas.
2. NFC PHOTO-VERIFIED ACCOUNTABILITY: Timestamped digital proof-of-work logs delivered before clinic doors open — so office managers and hygienists never waste 7:45 AM re-cleaning or chasing an absentee crew.
3. LOCAL METRO NY TEAM & TRANSPARENT FLAT-RATE PRICING: Locally managed crews across Long Island, NYC, Yonkers & Westchester (never an absentee national franchise), with flat-rate pricing and no long-term lock-in.

TARGET PRACTICE CONTEXT:
- Practice Name: {{cleanBizName}}
- Contact: {{contactName}} ({{contactTitle}})
- Town / Neighborhood: {{city}}
- Clinical Focus: {{clinicType}}
- Specific Observation: {{keyObservation}}

COPYWRITING RULES:
1. Strictly under 95 words. Conversational, peer-to-peer, respectful of a busy practice schedule.
2. Open with a concrete reference tailored to {{cleanBizName}} using {{keyObservation}} (NEVER generic "local practices" filler).
3. If Clinical Focus is "ortho", emphasize open-bay chairs, parent/teen waiting-room first impressions, and scanner/bracket-dust detailing. Otherwise emphasize operatory terminal cleaning, chair upholstery safety, and RDH/DA relief.
4. One clear, low-friction CTA: ask if they'd like to see a 60-second sample nightly verification log or schedule a free 15-minute after-hours hygiene audit for {{cleanBizName}}.
5. Subject line: short (3-6 words), conversational, lowercase or sentence case (e.g. "quick question for {{cleanBizName}}" or "pre-opening logs — {{cleanBizName}}").
6. Do NOT include a sign-off block (signature is appended automatically) — end with "Best,\nChris".

Return ONLY valid JSON:
{
  "subject": "subject line",
  "body": "email body text with paragraph breaks"
}`;

export const DEFAULT_SDR_INTENT_TRIAGE_PROMPT = `You are an SDR Safety and Intent Triage Agent for XIRI Facility Solutions.
Your job is to analyze inbound email replies and high-intent engagement actions from prospective dental and orthodontic practices across Metro NY.

DETERMINE IF A HUMAN HANDOFF IS REQUIRED:
A human handoff is REQUIRED whenever:
- The prospect expresses positive interest ("Yes, send info", "Call me tomorrow", "What are your rates?", "Send a sample log", "Audit")
- The prospect asks a genuine question ("Are you insured?", "Who else do you clean for in Westchester / Brooklyn / Garden City?", "Do you clean after 8 PM?")
- The prospect requests a quote, pricing, or walkthrough

A human handoff is NOT required if:
- Auto-responder / Out of Office ("I am out of office until Monday")
- Hard negative / Unsubscribe ("Please remove us", "Not interested", "Stop emailing")
- Spam or delivery bounce

LEAD CONTEXT:
- Practice: {{businessName}}
- Contact: {{contactName}} ({{contactTitle}})
- Email: {{leadEmail}}
- Event / Reply:
{{inboundContent}}

Return ONLY valid JSON:
{
  "intent": "positive_interest" | "question_pricing" | "question_scope" | "out_of_office" | "negative_not_interested" | "negative_unsubscribe" | "ambiguous",
  "isHotLead": boolean,
  "confidence": number (0 to 1),
  "summary": "1-sentence executive summary of what the prospect said/did",
  "action": "hand_off_to_human" | "continue_drip" | "suppress_contact"
}`;

export function cleanBusinessName(name: string): string {
    return sharedCleanBusinessName(name) || name.replace(/\s*,?\s*(P\.?C\.?|L\.?L\.?C\.?|P\.?L\.?L\.?C\.?|Inc\.?|Corp\.?|D\.?D\.?S\.?|D\.?M\.?D\.?|M\.?D\.?)$/i, '').trim();
}

/**
 * Generate a response-optimized personalized outreach draft for a target practice.
 */
export async function generateOutreachDraft(params: {
    businessName: string;
    contactName?: string | null;
    contactTitle?: string | null;
    location?: string | null;
    clinicType?: string | null;
    keyObservation?: string | null;
    geminiApiKey?: string;
}): Promise<{ subject: string; body: string; promptVersion: string }> {
    const promptVersion = 'sdr_copywriter_dental_ortho_v2';
    const apiKey = params.geminiApiKey || process.env.GEMINI_API_KEY;
    const cleanBiz = cleanBusinessName(params.businessName) || params.businessName;
    const city = params.location ? params.location.split(',')[0].trim() : 'Metro NY';
    const isOrtho = (params.clinicType || '').toLowerCase().includes('ortho') ||
        params.businessName.toLowerCase().includes('orthodont');
    const clinicTypeLabel = isOrtho ? 'orthodontic practice' : (params.clinicType || 'dental practice');

    if (apiKey) {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const { resolveGeminiModel } = await import('./gemini');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: resolveGeminiModel('gemini-2.5-flash'),
                generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
            });

            const prompt = await getPrompt('sdr_copywriter', DEFAULT_SDR_COPYWRITER_PROMPT, {
                cleanBizName: cleanBiz,
                contactName: params.contactName && params.contactName !== 'Practice Manager' && params.contactName !== 'Office Manager'
                    ? params.contactName.split(' ')[0]
                    : 'there',
                contactTitle: params.contactTitle || 'Office Manager',
                city,
                clinicType: clinicTypeLabel,
                keyObservation: params.keyObservation || `private ${clinicTypeLabel} in ${city}`,
            });

            const result = await model.generateContent(prompt);
            const rawText = result.response.text();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.subject && parsed.body) {
                    return {
                        subject: parsed.subject,
                        body: parsed.body,
                        promptVersion,
                    };
                }
            }
        } catch (err: any) {
            logger.warn(`[generateOutreachDraft] Gemini generation failed for ${cleanBiz}:`, err?.message || err);
        }
    }

    const contact = params.contactName && params.contactName !== 'Practice Manager' && params.contactName !== 'Office Manager'
        ? params.contactName.split(' ')[0]
        : 'there';

    if (isOrtho) {
        return {
            subject: `quick question for ${cleanBiz}`,
            body: `Hi ${contact},\n\nBetween open-bay chairs, iTero scanners, and high-traffic parent waiting areas, standard janitorial crews usually miss the details that matter most in an orthodontic clinic.\n\nOur local NY team specializes in orthodontic practices — protecting chair upholstery with EPA List N disinfectants and sending timestamped, photo-verified NFC logs before your first patient walks in.\n\nOpen to seeing a 60-second sample nightly verification log (or a free 15-min audit) for ${cleanBiz}?\n\nBest,\nChris`,
            promptVersion,
        };
    }

    return {
        subject: `pre-opening logs — ${cleanBiz}`,
        body: `Hi ${contact},\n\nWe handle nightly, OSHA-compliant operatory and sterilization-area cleaning for private dental practices across Long Island, NYC, and Westchester.\n\nInstead of making your office manager or hygienists do a 7:45 AM spot check, our local team sends timestamped, NFC photo-verified completion logs before your doors open — using chair-safe EPA List N protocols.\n\nOpen to seeing a 60-second sample nightly verification log for ${cleanBiz}?\n\nBest,\nChris`,
        promptVersion,
    };
}
