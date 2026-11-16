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
        q: "How is XIRI different from hiring a cleaning company?",
        a: "A cleaning company does one thing. XIRI replaces your cleaning company, your handyman, your supply vendor, and your compliance paperwork with one partner. We vet and manage the contractors, verify every shift via NFC tags, and send you one consolidated invoice.",
        context: 'homepage',
    },
    {
        q: "Do you specialize in dental offices and clinical facilities?",
        a: "Yes. Dental practices and medical suites have unique terminal cleaning requirements — from CDC Dental (DHCP) and OSHA Bloodborne Pathogen protocols to protecting expensive dental chair upholstery from harsh chemicals. Explore our dedicated Dental Office Hub at /industries/healthcare/dental-offices for our full operatory and sterilization suite protocol.",
        context: 'homepage',
    },
    {
        q: "How do you verify cleaning quality every night?",
        a: "We mount NFC tags in every zone of your facility (lobbies, operatories, exam rooms, restrooms). Cleaners tap their phone in each zone to complete a custom digital checklist, and our Night Managers audit the work — giving you a timestamped verification report by morning.",
        context: 'homepage',
    },
    {
        q: "What if I'm already under contract with another vendor?",
        a: "We can work with your existing schedule or even layer NFC verification on top of your current crew. Most transitions happen within 2–3 weeks with zero disruption to your operations. Start with a free site audit so you can compare apples to apples.",
        context: 'homepage',
    },
    {
        q: "Is there a long-term contract?",
        a: "No. We work on month-to-month agreements. We earn your business every month through verified nightly results, not lock-in contracts.",
        context: 'homepage',
    },
    {
        q: "What areas do you serve?",
        a: "We serve commercial, dental, and medical facilities across Nassau County, Suffolk County, and Queens — including enterprise field deployments at landmarks like UBS Arena. Enter your zip code above to check coverage and scope your building.",
        context: 'homepage',
    },
];
