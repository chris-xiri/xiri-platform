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
        a: "A cleaning company does one thing. XIRI replaces your cleaning company, your handyman, your supply vendor, and your compliance paperwork with one partner. We vet and manage the contractors, verify every shift, and send you one invoice.",
        context: 'homepage',
    },
    {
        q: "What if I'm already under contract with another vendor?",
        a: "We can work with your existing schedule. Most transitions happen within 2-3 weeks with zero disruption to your operations. We'll conduct a free site audit first so you can compare apples to apples.",
        context: 'homepage',
    },
    {
        q: "How do you verify cleaning quality every night?",
        a: "Our contractors complete a digital checklist after every shift that documents what was cleaned, restocked, and inspected. You get a verification report automatically — no chasing anyone for updates.",
        context: 'homepage',
    },
    {
        q: "Is there a long-term contract?",
        a: "No. We work on month-to-month agreements. We earn your business every month, not through a contract — through results.",
        context: 'homepage',
    },
    {
        q: "What areas do you serve?",
        a: "We currently serve Nassau County and the greater Long Island area, with plans to expand. Enter your zip code above to check if we've reached your area yet.",
        context: 'homepage',
    },
];
