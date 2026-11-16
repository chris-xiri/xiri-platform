// ─── FAQs ────────────────────────────────────────────────────────
// Used by: HomepageFAQ, potentially industry/service pages.

export interface FAQ {
    q: string;
    a: string;
    /** Optional: tag for filtering (e.g. 'homepage', 'medical', 'pricing') */
    context?: string;
}

export const HOMEPAGE_FAQS: FAQ[] = [
    {
        q: "How is XIRI different from hiring a typical janitorial crew for our dental office?",
        a: "Generic cleaning crews treat dental operatories like standard office cubicles — often damaging expensive dental chair upholstery with harsh chemicals or skipping sterilization areas. XIRI deploys clinical-trained teams that follow CDC Dental (DHCP) and OSHA Bloodborne Pathogen protocols, verify every zone via NFC tags, restock your soap and paper supplies, and send your office manager one consolidated invoice.",
        context: 'homepage',
    },
    {
        q: "How do you protect our dental chairs and clinical equipment during terminal cleaning?",
        a: "We never use corrosive bleach or unapproved sprays on delicate dental chairs. Our checklists enforce surface-specific EPA List N disinfectants and manufacturer-approved protocols — disinfecting floors, cabinetry, sinks, sterilization counters, and waiting areas while protecting your operatory investments.",
        context: 'homepage',
    },
    {
        q: "How do dentist-owners and office managers verify cleaning quality every night?",
        a: "We mount NFC tags in each zone of your practice (e.g., Operatories, Sterilization Lab, Patient Restrooms, Waiting Room). Cleaners tap their phone in each zone and complete a custom terminal cleaning checklist. You get a timestamped verification log by morning — no guessing if the crew actually showed up.",
        context: 'homepage',
    },
    {
        q: "What if we're already under contract with another cleaning company?",
        a: "We can work around your existing timeline or even install NFC verification on top of your current crew. Most transitions happen within 2–3 weeks with zero disruption to your patient schedule. Start with a free practice walk-through to compare apples to apples.",
        context: 'homepage',
    },
    {
        q: "Is there a long-term contract?",
        a: "No. We work on month-to-month agreements. We earn your practice's business every month through verified nightly results, not lock-in contracts.",
        context: 'homepage',
    },
    {
        q: "What areas do you serve?",
        a: "We serve dental practices, medical suites, and commercial facilities across Nassau County, Suffolk County, Queens, and the greater Long Island area — including enterprise field deployments at landmarks like UBS Arena. Enter your zip code above to scope your practice.",
        context: 'homepage',
    },
];
