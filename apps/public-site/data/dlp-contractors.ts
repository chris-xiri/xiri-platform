// Contractor DLP Data — Trades, Geo, Keywords, Guides
import seoData from '@/data/seo-data.json';

export interface ContractorTrade {
    title: string; h1: string; subtitle: string; metaDescription: string;
    valueProps: { title: string; description: string }[];
    faqs: { question: string; answer: string }[];
}

export interface ContractorGeo {
    title: string; h1: string; subtitle: string; metaDescription: string;
    localTexture: string; mapCenter: { lat: number; lng: number };
    faqs: { question: string; answer: string }[];
}

export interface ContractorKeyword {
    title: string; h1: string; subtitle: string; metaDescription: string;
    sections: { title: string; content: string }[];
    faqs: { question: string; answer: string }[];
}

// ── TRADES (6) ──
export const TRADES: Record<string, ContractorTrade> = {
    'janitorial-subcontractor': {
        title: 'Janitorial Subcontractor Opportunities',
        h1: 'Janitorial Subcontractor Opportunities on Long Island',
        subtitle: 'Get steady commercial cleaning contracts without cold-calling. XIRI handles the sales — you handle the mop.',
        metaDescription: 'Janitorial subcontractor opportunities on Long Island and Nassau County. Steady commercial cleaning contracts, no sales required. Apply to the XIRI contractor network.',
        valueProps: [
            { title: 'Steady Work, No Sales', description: 'We source and close clients. You get recurring contracts with reliable schedules — no cold calling, no bidding, no chasing invoices.' },
            { title: 'Route Density', description: 'Our facilities are clustered in Nassau County corridors. Less driving, more cleaning, better margins.' },
            { title: 'Paid on Time, Every Time', description: 'XIRI pays contractors on a fixed schedule regardless of client payment cycles. No accounts receivable headaches.' },
        ],
        faqs: [
            { question: 'How do I apply to become a XIRI janitorial subcontractor?', answer: 'Visit xiri.ai/contractors and complete the application. We verify insurance (GL + WC), review your experience, and schedule an onboarding call.' },
            { question: 'Do I need my own equipment?', answer: 'Yes. XIRI subcontractors provide their own equipment and supplies. We specify approved chemical brands and equipment standards for each facility type.' },
            { question: 'What areas do you need janitorial subcontractors?', answer: 'We are actively recruiting in Nassau County, with focus on the Great Neck, New Hyde Park, Garden City, and Mineola corridors.' },
        ],
    },
    'hvac-subcontractor': {
        title: 'HVAC Subcontractor Opportunities',
        h1: 'HVAC Subcontractor Opportunities in Nassau County',
        subtitle: 'Join our network for preventive HVAC maintenance contracts across medical offices, commercial buildings, and institutional facilities.',
        metaDescription: 'HVAC subcontractor opportunities in Nassau County. Preventive maintenance contracts for medical and commercial facilities. Apply to the XIRI contractor network.',
        valueProps: [
            { title: 'Quarterly Filter Programs', description: 'Recurring quarterly HVAC filter change programs across multiple facilities. Predictable revenue, scheduled in advance.' },
            { title: 'Medical-Grade Facilities', description: 'Our clients include medical offices, surgery centers, and labs — facilities that prioritize indoor air quality and pay for quality service.' },
            { title: 'One Relationship, Many Sites', description: 'Instead of managing 20 client relationships, manage one — XIRI. We handle all scheduling, billing, and client communication.' },
        ],
        faqs: [
            { question: 'What HVAC services does XIRI subcontract?', answer: 'Primarily preventive maintenance: filter changes, coil cleaning, belt inspections, and seasonal tune-ups. We do not currently subcontract major repairs or installations.' },
            { question: 'Do I need EPA 608 certification?', answer: 'Yes. All HVAC subcontractors must hold EPA 608 Universal certification and carry appropriate insurance.' },
        ],
    },
    'landscaping-subcontractor': {
        title: 'Landscaping Subcontractor Opportunities',
        h1: 'Landscaping Subcontractor Opportunities on Long Island',
        subtitle: 'Commercial landscaping and grounds maintenance contracts for medical campuses, auto dealerships, and professional parks.',
        metaDescription: 'Landscaping subcontractor opportunities on Long Island. Commercial grounds maintenance for medical and commercial facilities. Join the XIRI network.',
        valueProps: [
            { title: 'Year-Round Contracts', description: 'Spring/summer mowing and maintenance, fall cleanup, winter snow partnerships. Revenue across all four seasons.' },
            { title: 'Professional Properties', description: 'Medical campuses, auto dealerships, and professional parks — properties where curb appeal directly impacts business.' },
            { title: 'Bundled Snow Opportunities', description: 'Landscaping subcontractors get first priority for snow and ice removal contracts at the same properties.' },
        ],
        faqs: [
            { question: 'What landscaping services does XIRI subcontract?', answer: 'Mowing, edging, mulching, seasonal plantings, leaf removal, and general grounds maintenance. Some properties also require irrigation management.' },
            { question: 'Can I also do snow removal?', answer: 'Yes. Landscaping subcontractors are prioritized for snow and ice removal contracts at their assigned properties during winter months.' },
        ],
    },
    'plumbing-subcontractor': {
        title: 'Plumbing Subcontractor Opportunities',
        h1: 'Plumbing Subcontractor Opportunities in Nassau County',
        subtitle: 'On-call and preventive plumbing maintenance for commercial and medical facilities across Nassau County.',
        metaDescription: 'Plumbing subcontractor opportunities in Nassau County for commercial and medical facilities. Join the XIRI contractor network.',
        valueProps: [
            { title: 'Preventive Maintenance Contracts', description: 'Scheduled inspections, fixture maintenance, and backflow testing for medical and commercial facilities.' },
            { title: 'Priority Emergency Calls', description: 'When our facilities have plumbing emergencies, XIRI subcontractors get first call — reliable work without competing on price.' },
            { title: 'Medical Facility Expertise', description: 'Medical offices and labs require plumbers who understand medical gas, vacuum systems, and infection control protocols.' },
        ],
        faqs: [
            { question: 'What plumbing work does XIRI subcontract?', answer: 'Preventive maintenance, fixture repairs, drain cleaning, backflow testing, and emergency response for commercial and medical facilities.' },
            { question: 'Do I need a Nassau County plumbing license?', answer: 'Yes. All plumbing subcontractors must be licensed in Nassau County and carry appropriate insurance.' },
        ],
    },
    'electrical-subcontractor': {
        title: 'Electrical Subcontractor Opportunities',
        h1: 'Electrical Subcontractor Opportunities on Long Island',
        subtitle: 'Commercial electrical maintenance and lighting contracts for medical offices, data centers, and commercial buildings.',
        metaDescription: 'Electrical subcontractor opportunities on Long Island for commercial and medical facilities. Join the XIRI contractor network.',
        valueProps: [
            { title: 'Lighting Retrofit Programs', description: 'LED conversion projects, ballast replacements, and emergency lighting testing across commercial facilities.' },
            { title: 'Medical Office Specs', description: 'Medical facilities require specific lighting standards for exam rooms and surgical suites — specialized work that commands premium rates.' },
            { title: 'Recurring Maintenance', description: 'Panel inspections, emergency lighting tests, and generator maintenance on scheduled intervals.' },
        ],
        faqs: [
            { question: 'What electrical work does XIRI subcontract?', answer: 'Lighting maintenance, LED retrofits, emergency lighting testing, panel inspections, and general electrical repairs for commercial facilities.' },
            { question: 'Do I need specific certifications?', answer: 'A valid NY State electrical license is required. Additional certifications for medical facility work (e.g., NFPA 99 knowledge) are preferred.' },
        ],
    },
    'handyman-subcontractor': {
        title: 'Handyman Subcontractor Opportunities',
        h1: 'Handyman Subcontractor Opportunities in Nassau County',
        subtitle: 'General maintenance and repair work across our network of commercial and medical facilities.',
        metaDescription: 'Handyman subcontractor opportunities in Nassau County. General maintenance for commercial and medical facilities. Join the XIRI contractor network.',
        valueProps: [
            { title: 'Diverse Work Orders', description: 'Drywall, painting, door hardware, ceiling tile, fixture installation — variety keeps the work interesting.' },
            { title: 'Steady Pipeline', description: 'Our FSMs identify maintenance needs during weekly site visits. Work orders flow consistently without you marketing.' },
            { title: 'Same Properties, Growing Scope', description: 'Start with basic handyman work and expand into more specialized maintenance as trust builds.' },
        ],
        faqs: [
            { question: 'What handyman services does XIRI subcontract?', answer: 'General repairs: drywall, painting, door/hardware, ceiling tiles, fixture installations, minor carpentry, and general building maintenance.' },
            { question: 'Do I need a contractor license?', answer: 'A Nassau County Home Improvement Contractor license is preferred. General liability insurance is required.' },
        ],
    },
};

// ── GEO PAGES (2) ──
const locations = seoData.locations as any[];
export function getGeoPages(): Record<string, ContractorGeo> {
    const pages: Record<string, ContractorGeo> = {};
    for (const loc of locations) {
        const slug = `cleaning-jobs-in-${loc.slug}`;
        pages[slug] = {
            title: `Cleaning Jobs in ${loc.name}`,
            h1: `Contractor Opportunities in ${loc.name}`,
            subtitle: `Join the XIRI network and get steady facility maintenance contracts in the ${loc.name} corridor.`,
            metaDescription: `Cleaning and facility maintenance subcontractor jobs in ${loc.name}. Janitorial, HVAC, landscaping, and handyman opportunities. Join the XIRI network.`,
            localTexture: loc.localInsight || '',
            mapCenter: { lat: loc.latitude || 40.75, lng: loc.longitude || -73.7 },
            faqs: loc.localFaqs?.slice(0, 2) || [],
        };
    }
    return pages;
}

// ── KEYWORD PAGES (3) ──
export const KEYWORD_PAGES: Record<string, ContractorKeyword> = {
    'subcontractor-opportunities': {
        title: '1099 Subcontractor Opportunities',
        h1: 'Subcontractor Opportunities for Cleaning LLCs & Independent Contractors',
        subtitle: 'We handle the sales, the billing, and the client management. You bring the crew, the equipment, and the expertise.',
        metaDescription: '1099 cleaning subcontractor opportunities in Nassau County and Long Island. Steady contracts for cleaning LLCs, no cold calling. Apply to the XIRI partner network.',
        sections: [
            { title: 'How the XIRI 1099 Partnership Works', content: 'XIRI sources and closes commercial facility clients. We match each facility to a vetted, insured subcontractor from our network. You clean. Our Night Managers audit. The client sees consistent quality. You get paid on schedule — no chasing invoices, no managing client expectations.' },
            { title: 'What We Need From You', content: 'A legal business entity (LLC preferred), general liability insurance ($1M minimum), workers\' compensation (if you have employees), commercial auto insurance, and a reliable crew. We verify everything during onboarding.' },
            { title: 'Why LLCs Choose XIRI', content: 'Most small cleaning companies spend 40% of their time on sales and admin. XIRI eliminates that. You focus 100% on service delivery while we handle sourcing, scheduling, billing, and quality assurance. Your revenue grows without growing your overhead.' },
        ],
        faqs: [
            { question: 'Is this a 1099 or W-2 relationship?', answer: 'All XIRI subcontractors operate as independent 1099 contractors through their own business entities. You maintain full control of your crew, equipment, and methods — we define the scope, schedule, and quality standards.' },
            { question: 'How much can I earn as an XIRI subcontractor?', answer: 'Earnings depend on the number of facilities, service frequency, and scope. Most janitorial subcontractors earn $3,000–$8,000/month per facility cluster of 3–5 locations.' },
            { question: 'Do I need to provide my own supplies?', answer: 'Yes. Subcontractors provide their own equipment and supplies. We specify approved chemical brands and equipment standards for each facility type.' },
        ],
    },
    'medical-cleaning-careers': {
        title: 'Medical Cleaning Careers',
        h1: 'Medical Cleaning Subcontractor Careers — HIPAA & cGMP Trained',
        subtitle: 'Your training has value. We pay for it. XIRI needs contractors with healthcare cleaning expertise.',
        metaDescription: 'Medical cleaning subcontractor opportunities for HIPAA and cGMP trained cleaners. Premium rates for specialized healthcare facility maintenance.',
        sections: [
            { title: 'Why Medical Cleaning Pays More', content: 'Medical offices, surgery centers, and labs require cleaners who understand bloodborne pathogen protocols, terminal cleaning procedures, and compliance documentation. That expertise commands premium rates — and XIRI pays accordingly.' },
            { title: 'What Training We Value', content: 'HIPAA awareness training, bloodborne pathogen certification (OSHA), terminal cleaning procedures, cGMP or cleanroom experience, and any JCAHO/CMS compliance training. If you\'ve worked in a hospital, ASC, or regulated lab, you\'re already qualified.' },
            { title: 'The XIRI Standard Track', content: 'All medical cleaning subcontractors complete XIRI\'s Standard Track onboarding: a structured program that verifies your existing training, fills any gaps, and certifies you for specific facility types. It\'s not a class — it\'s a validation of what you already know.' },
        ],
        faqs: [
            { question: 'Do I need special certifications for medical cleaning?', answer: 'At minimum: OSHA bloodborne pathogen training and HIPAA awareness. For surgery centers: terminal cleaning training. For labs: cGMP or cleanroom experience. XIRI provides gap training during onboarding.' },
            { question: 'What does the XIRI Standard Track include?', answer: 'A structured onboarding program that validates your existing training, covers XIRI-specific protocols, and certifies you for medical, surgical, dental, or lab facility types.' },
        ],
    },
    'facility-management-rfp': {
        title: 'Facility Management RFP & Bidding',
        h1: 'Facility Management RFP — One Bid, Dozens of Facilities',
        subtitle: 'Submit one proposal to XIRI and gain access to our entire portfolio of commercial and medical facilities.',
        metaDescription: 'Respond to XIRI facility management RFPs for medical and commercial properties in Nassau County. One bid covers multiple facilities.',
        sections: [
            { title: 'How XIRI RFPs Work', content: 'Unlike traditional RFPs where you bid on one building, XIRI RFPs cover facility clusters — groups of 3–10 properties in the same geographic corridor. Win one bid, get multiple recurring contracts.' },
            { title: 'What We Evaluate', content: 'Insurance coverage and limits, equipment inventory and condition, crew size and availability, references from similar facility types, geographic coverage area, and response time for emergencies.' },
            { title: 'Current Openings', content: 'We are actively seeking vendors for: janitorial services in the Great Neck/New Hyde Park corridor, HVAC maintenance across Nassau County, and landscaping/snow removal for medical campuses.' },
        ],
        faqs: [
            { question: 'How do I respond to a XIRI RFP?', answer: 'Apply at xiri.ai/contractors. Our recruitment team will share active RFPs that match your capabilities. You submit scope, pricing, and references — we evaluate and select.' },
            { question: 'Can established companies with existing clients apply?', answer: 'Absolutely. Many of our best subcontractors have their own client base and add XIRI facilities to fill schedule gaps and grow revenue.' },
        ],
    },
};

// ── GUIDE PAGES (3) ──
export const GUIDE_PAGES: Record<string, ContractorKeyword> = {
    'how-to-bid-institutional-medical-contracts': {
        title: 'How to Bid on Institutional Medical Contracts in NY',
        h1: 'How to Bid on Institutional Medical Cleaning Contracts in New York',
        subtitle: 'A contractor\'s guide to winning medical facility cleaning contracts — from insurance requirements to compliance documentation.',
        metaDescription: 'Guide for contractors bidding on medical cleaning contracts in NY. Insurance requirements, compliance standards, and pricing strategies.',
        sections: [
            { title: 'Understanding Medical Facility Requirements', content: 'Medical cleaning contracts aren\'t won on price alone. Facilities need contractors who understand JCAHO environmental standards, OSHA bloodborne pathogen requirements, and proper documentation protocols. This guide walks you through what decision-makers actually evaluate.' },
            { title: 'Insurance Minimums for Medical Facilities', content: 'Most medical facilities require: $1M/$2M General Liability, Workers\' Compensation, Commercial Auto, and sometimes Professional Liability (E&O). Some surgery centers require $5M umbrella policies. Budget for these before you bid.' },
            { title: 'Pricing Strategies That Win', content: 'Don\'t underbid. Medical facilities fire low-cost providers more than any other segment. Price for quality: include compliance documentation time, proper PPE, and EPA-registered chemicals in your cost model. The winning bid is rarely the cheapest — it\'s the most credible.' },
        ],
        faqs: [
            { question: 'What insurance do I need to bid on medical cleaning contracts?', answer: 'At minimum: $1M/$2M GL, Workers\' Comp, and Commercial Auto. Surgery centers and hospitals typically require $5M umbrella coverage.' },
            { question: 'How do I demonstrate compliance capability?', answer: 'Show your OSHA training records, bloodborne pathogen certifications, chemical SDS management system, and any existing cleaning logs. If you don\'t have these, build them before bidding.' },
        ],
    },
    'xiri-compliance-requirements': {
        title: 'XIRI Compliance Requirements — COI, OSHA & Vetting',
        h1: 'XIRI Standard Track: Compliance & Vetting Requirements',
        subtitle: 'What you need to qualify for the XIRI contractor network — insurance, training, and documentation standards.',
        metaDescription: 'XIRI contractor compliance requirements: COI, OSHA training, insurance minimums, and vetting process for janitorial and facility maintenance subcontractors.',
        sections: [
            { title: 'Insurance Requirements (COI)', content: 'All XIRI subcontractors must maintain: General Liability ($1M per occurrence / $2M aggregate), Workers\' Compensation (statutory limits), Commercial Auto ($1M combined single limit). Certificates of Insurance must name XIRI Facility Solutions as additional insured.' },
            { title: 'OSHA Training Requirements', content: 'Minimum training: OSHA 10-Hour General Industry, Bloodborne Pathogen Exposure Control (for medical facilities), Hazard Communication (GHS/SDS), and proper PPE usage. XIRI provides supplemental training during onboarding.' },
            { title: 'The Vetting Process', content: 'Step 1: Application and document submission. Step 2: Insurance and license verification. Step 3: Reference checks (minimum 3 commercial references). Step 4: Background screening. Step 5: Onboarding and facility-specific training. Step 6: Probationary period (first 90 days with enhanced auditing).' },
        ],
        faqs: [
            { question: 'How long does the vetting process take?', answer: 'Typically 5–10 business days from application to approval, assuming all documents are provided promptly.' },
            { question: 'What if I don\'t have all the required training?', answer: 'We provide gap training during onboarding. If you\'re missing OSHA 10-Hour or BBP training, we\'ll help you get certified before your first assignment.' },
        ],
    },
    'equipment-specs-surgical-grade': {
        title: 'Equipment Specs for Surgical-Grade Protocols',
        h1: 'Equipment Specs for XIRI Surgical-Grade Cleaning Protocols',
        subtitle: 'HEPA-H13 vacuums, EPA-registered disinfectants, and medical-grade tools — what you need to clean for XIRI.',
        metaDescription: 'Equipment specifications for XIRI surgical-grade cleaning protocols. HEPA-H13 vacuums, EPA-registered chemicals, and PPE requirements.',
        sections: [
            { title: 'Vacuum Requirements', content: 'All XIRI medical facility assignments require HEPA-H13 filtered vacuums. H13 filters capture 99.95% of particles at 0.3 microns. Consumer-grade vacuums are not permitted. Recommended brands: ProTeam, Windsor Sensor, NSS Pacer.' },
            { title: 'Chemical Requirements', content: 'All disinfectants must be EPA-registered and appear on EPA List N (antimicrobial products for use against pathogens). Products must have documented contact times. Current SDS sheets must be maintained for every product used. Approved brands include Clorox Healthcare, Diversey Oxivir, and Spartan BioRenewables.' },
            { title: 'PPE Requirements', content: 'Medical facilities: nitrile gloves, safety glasses, closed-toe shoes. Surgery centers: add shoe covers, hair covers, and face masks. BSL-2 labs: full PPE including gowns and face shields. All PPE is the responsibility of the subcontractor.' },
        ],
        faqs: [
            { question: 'Can I use my existing equipment?', answer: 'If your vacuum has HEPA-H13 filtration and your chemicals are EPA List N registered, yes. We verify equipment during onboarding and provide a list of approved products.' },
            { question: 'Does XIRI supply PPE?', answer: 'No. PPE is the subcontractor\'s responsibility. We specify requirements by facility type and verify compliance during Night Manager audits.' },
        ],
    },
};
