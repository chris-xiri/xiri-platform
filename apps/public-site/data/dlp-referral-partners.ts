// ─── Referral Partner pSEO Data ──────────────────────────────────────
// 12 trade types that service single-tenant commercial buildings.
// Each generates /refer/[slug] + /refer/[slug]-in-[location] pages.

export interface ReferralPartner {
    title: string;
    h1: string;
    subtitle: string;
    metaDescription: string;
    /** Pitch line shown on the hub page card */
    pitch: string;
    /** Icon emoji for hub page */
    icon: string;
    valueProps: { title: string; description: string }[];
    /** Why this trade is a perfect referral partner */
    whyYou: string;
    faqs: { question: string; answer: string }[];
}

// ═══════════════════════════════════════════════════════════════════
// PAYOUT CONSTANTS — Single source of truth. Change here, updates everywhere.
// ═══════════════════════════════════════════════════════════════════
export const REFERRAL_FEE = 500;
export const WALKTHROUGH_BONUS = 100;
export const CLOSE_BONUS = 400;
export const RECURRING_BONUS = 50;

// ─── ICP: Ideal Commercial Building for Referral ────────────────────
export const ICP_QUALIFICATIONS = {
    headline: 'What Buildings Qualify?',
    subheadline: 'We serve single-tenant commercial buildings in Nassau County. Here\'s what makes a great referral:',
    buildingTypes: [
        { label: 'Medical Offices & Urgent Care', icon: '🏥' },
        { label: 'Dental Practices', icon: '🦷' },
        { label: 'Professional / Law Offices', icon: '💼' },
        { label: 'Auto Dealerships', icon: '🚗' },
        { label: 'Retail & Storefronts', icon: '🏪' },
        { label: 'Veterinary Clinics', icon: '🐾' },
        { label: 'Daycare & Preschools', icon: '👶' },
        { label: 'Churches & Houses of Worship', icon: '⛪' },
        { label: 'Fitness Studios & Gyms', icon: '💪' },
        { label: 'Surgery Centers', icon: '🔬' },
    ],
    sizeRange: '2,000 – 25,000 sq ft',
    geography: 'Nassau County, NY (expanding to Suffolk County)',
    notAFit: [
        'Residential homes or apartments',
        'Multi-tenant office towers (100K+ sqft)',
        'Buildings already under contract with XIRI',
    ],
};

// ─── General FAQs (shown on hub + all trade pages) ──────────────────
export const GENERAL_FAQS = [
    { question: 'What types of buildings qualify for the referral program?', answer: 'Single-tenant commercial buildings in Nassau County between 2,000 – 25,000 sq ft. This includes medical offices, dental practices, professional offices, auto dealerships, retail, daycares, gyms, churches, and more. We do NOT service residential properties.' },
    { question: 'Is this program for residential cleaning referrals?', answer: 'No. XIRI only provides commercial janitorial services. We do not clean homes, apartments, or residential properties. All referrals must be for commercial or institutional buildings.' },
    { question: 'How much do I earn per referral?', answer: `A minimum of $${REFERRAL_FEE} per building, paid in stages: $${WALKTHROUGH_BONUS} when you join us for the building walkthrough, then $${CLOSE_BONUS} when the cleaning contract goes live. Plus a $${RECURRING_BONUS}/month recurring bonus for as long as the contract remains active. There is no cap on referrals.` },
    { question: 'When do I get paid?', answer: `$${WALKTHROUGH_BONUS} after the walkthrough — that same week. The remaining $${CLOSE_BONUS} is paid 60 days after the cleaning contract goes live. The $${RECURRING_BONUS}/month recurring bonus starts the following month. Payments via check or direct deposit.` },
    { question: 'Do I need to sell anything?', answer: 'No selling required. Just make an introduction — share the building manager\'s name and contact info. XIRI handles quoting, negotiation, and contract execution.' },
    { question: 'Can I refer a building that already has a cleaning company?', answer: 'Yes. Many building managers are unhappy with their current cleaning provider. If they\'re open to a quote, it\'s a valid referral. XIRI competes on quality and reliability, not just price.' },
    { question: 'Is there a limit on how many buildings I can refer?', answer: `No cap. Every building that converts to a XIRI cleaning contract earns you $${REFERRAL_FEE} + $${RECURRING_BONUS}/month. Top referral partners earn $5,000+ per year.` },
];

export const REFERRAL_PARTNERS: Record<string, ReferralPartner> = {
    'plumber-referral-partner': {
        title: 'Plumber Referral Partner Program',
        h1: `Plumbers: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You fix pipes. We clean floors. Refer a building you already service and earn a $${REFERRAL_FEE} bonus + $${RECURRING_BONUS}/month recurring.`,
        metaDescription: `Plumber referral program — earn $${REFERRAL_FEE} per building referred for commercial cleaning. Plus $${RECURRING_BONUS}/month recurring bonus. XIRI Facility Solutions in Nassau County.`,
        pitch: `You're already under the sink — refer the building and earn $${REFERRAL_FEE}.`,
        icon: '🔧',
        whyYou: `You respond to plumbing emergencies, run backflow tests, and maintain restroom fixtures in commercial buildings across Nassau County. You see the cleaning quality (or lack of it) firsthand. You know which building managers are frustrated with their current janitorial service. One introduction earns you $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'You\'re Already in the Building', description: `You're servicing commercial restrooms, break rooms, and mechanical rooms regularly. You see the cleaning quality every visit. That insight is worth $${REFERRAL_FEE} per referral.` },
            { title: `$${RECURRING_BONUS}/Month Passive Income`, description: `For as long as the referred building stays a XIRI client, you earn $${RECURRING_BONUS}/month. Refer 5 buildings and that's $${RECURRING_BONUS * 5}/month — every month — on top of your plumbing income.` },
            { title: 'No Competition, Just Complementary', description: 'We clean floors, you fix pipes. Referring a cleaning company doesn\'t cut into your business — it strengthens your relationship with the building manager.' },
        ],
        faqs: [
            { question: 'How does the plumber referral program work?', answer: `Fill out the form with the building name and manager contact. We reach out, quote the cleaning, and if we win the contract, you earn $${WALKTHROUGH_BONUS} for joining the walkthrough + $${CLOSE_BONUS} when the contract goes live. Plus $${RECURRING_BONUS}/month recurring for as long as the contract stays active.` },
            { question: 'What kind of buildings qualify?', answer: 'Any single-tenant commercial building in Nassau County that needs recurring janitorial service — medical offices, professional offices, dental practices, retail, auto dealerships, and more.' },
            { question: 'Do I need to sell anything?', answer: 'No selling required. Just make an introduction. "Hey, I know a commercial cleaning company that\'s really good — want me to connect you?" That\'s it.' },
            { question: 'When do I get paid?', answer: `$${WALKTHROUGH_BONUS} right after the building walkthrough — that same week. $${CLOSE_BONUS} paid 60 days after the cleaning contract goes live. $${RECURRING_BONUS}/month recurring starts the following month. Payments via check or direct deposit.` },
        ],
    },
    'electrician-referral-partner': {
        title: 'Electrician Referral Partner Program',
        h1: `Electricians: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You wire buildings. We clean them. Refer a commercial property and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month ongoing.`,
        metaDescription: `Electrician referral program — earn $${REFERRAL_FEE} per commercial building referred for cleaning services. Plus $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `You're already pulling wire — refer the building and earn $${REFERRAL_FEE}.`,
        icon: '⚡',
        whyYou: `You do tenant improvements, panel upgrades, and emergency repairs in commercial buildings across Long Island. You walk every hallway and see every restroom. When the cleaning is bad, you notice. One quick intro to the building manager earns you $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'Tenant Improvements = Cleaning Contracts', description: 'When you\'re doing TI work for a new tenant moving in, they need a cleaning company. You\'re the first person to know about the opportunity — before anyone else.' },
            { title: 'Recurring Income from One Conversation', description: `Refer a building, earn $${REFERRAL_FEE} upfront. Then $${RECURRING_BONUS}/month for as long as the contract is active. Five referrals = $${REFERRAL_FEE * 5 + RECURRING_BONUS * 5 * 12} in year one from conversations you're already having.` },
            { title: 'Strengthen Your Client Relationships', description: 'Being the person who solves problems beyond electrical work makes you indispensable. Building managers remember the electrician who connected them with a great cleaner.' },
        ],
        faqs: [
            { question: 'What triggers a good referral opportunity for electricians?', answer: 'Tenant move-ins (TI work), building manager complaints about current cleaning, new construction handoffs, or any time you hear "I need a new cleaning company." These are moments you encounter naturally.' },
            { question: 'How does the electrician referral program work?', answer: `Submit the building and manager info through our form. We handle the quoting and sales. You earn $${WALKTHROUGH_BONUS} for joining the walkthrough + $${CLOSE_BONUS} when the contract goes live + $${RECURRING_BONUS}/month recurring.` },
            { question: 'Can I refer multiple buildings?', answer: `Absolutely. There's no cap. Every building that converts to a XIRI cleaning contract earns you $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.` },
            { question: 'Is this available outside Nassau County?', answer: 'We\'re actively servicing Nassau County and expanding into Suffolk County. Referrals in both counties qualify.' },
        ],
    },
    'hvac-referral-partner': {
        title: 'HVAC Referral Partner Program',
        h1: `HVAC Technicians: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You change filters quarterly. We clean nightly. Refer a building on your route and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `HVAC referral program — earn $${REFERRAL_FEE} per commercial building referred for janitorial services. Plus $${RECURRING_BONUS}/month recurring bonus. XIRI Facility Solutions.`,
        pitch: `You're already on a quarterly PM schedule — refer the building for $${REFERRAL_FEE}.`,
        icon: '❄️',
        whyYou: `You're in commercial buildings every quarter for filter changes, coil cleaning, and seasonal tune-ups. You see the same lobbies, restrooms, and break rooms every visit. You know which buildings are clean and which aren't. That knowledge is worth $${REFERRAL_FEE} per referral.`,
        valueProps: [
            { title: 'Quarterly Visits = Quarterly Referral Opportunities', description: 'Every PM visit is a chance to notice cleaning quality. You\'re already building rapport with the facility manager over HVAC — extend that trust to cleaning.' },
            { title: 'Indoor Air Quality + Clean Facility = Happy Client', description: 'Your HVAC work keeps the air clean. Our cleaning keeps the surfaces clean. Referring XIRI makes your client\'s facility better overall — and they\'ll associate that improvement with you.' },
            { title: `$${RECURRING_BONUS}/Month Compounds Fast`, description: `With quarterly visits to 20+ buildings, even converting a few means $${RECURRING_BONUS * 3}-$${RECURRING_BONUS * 5}/month in recurring passive income on top of your HVAC revenue.` },
        ],
        faqs: [
            { question: 'How does the HVAC referral program work?', answer: `Next time you're on a PM visit and the building manager mentions cleaning, fill out our referral form. We quote the job, and if we win, you get $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} on contract close + $${RECURRING_BONUS}/month recurring.` },
            { question: 'What kind of buildings are best to refer?', answer: 'Single-tenant commercial buildings you visit regularly — medical offices (great fit since they need both HVAC and cleaning compliance), professional offices, retail spaces, and dental offices.' },
            { question: 'Does referring cleaning compete with my HVAC business?', answer: 'Not at all. We clean — you maintain HVAC systems. These are complementary services. Referring actually strengthens your position as a trusted facility partner.' },
            { question: 'Can I also apply to be an HVAC subcontractor for XIRI?', answer: 'Yes! We have a separate HVAC subcontractor program for quarterly filter changes and PM work. You can participate in both programs simultaneously.' },
        ],
    },
    'pest-control-referral-partner': {
        title: 'Pest Control Referral Partner Program',
        h1: `Pest Control Companies: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You treat buildings monthly. We clean them nightly. Refer a commercial property and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `Pest control referral program — earn $${REFERRAL_FEE} per commercial building referred for cleaning services. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `You're already treating the building monthly — refer it for $${REFERRAL_FEE}.`,
        icon: '🐛',
        whyYou: `You're in commercial kitchens, break rooms, and storage areas monthly. You see how clean (or dirty) the spaces are. Poor cleaning is often WHY you're there in the first place. Refer XIRI and you may actually reduce your callbacks — while earning $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'Poor Cleaning = More Pests', description: 'You know better than anyone: dirty buildings attract pests. Referring a great cleaning company actually reduces your pest complaints and callbacks. Better for you, better for the client.' },
            { title: 'Monthly Visits, Monthly Opportunities', description: `You're inside these buildings 12 times a year. Every visit is a chance to notice if the cleaning program is failing — and to make a referral that earns you $${REFERRAL_FEE}.` },
            { title: 'Same Client, Complementary Service', description: 'Pest control and janitorial are the two most common recurring facility contracts. You\'re not competing — you\'re completing the picture.' },
        ],
        faqs: [
            { question: 'How does the pest control referral program work?', answer: `Submit the building and manager info via our form. We handle sales and quoting. You earn $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract closes + $${RECURRING_BONUS}/month recurring.` },
            { question: 'What if the building already has a cleaning company?', answer: 'Many buildings are unhappy with their current cleaner. If the manager is open to a quote, that\'s a valid referral. We compete on quality, not just price.' },
            { question: 'Can I refer restaurant clients?', answer: 'Yes. Restaurants, medical offices, retail, offices — any commercial property with recurring cleaning needs qualifies.' },
        ],
    },
    'fire-protection-referral-partner': {
        title: 'Fire Protection Referral Partner Program',
        h1: `Fire Protection Companies: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You inspect sprinklers and extinguishers. We clean the rest. Refer a building and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `Fire protection referral program — earn $${REFERRAL_FEE} per commercial building referred for cleaning services. Recurring $${RECURRING_BONUS}/month bonus. XIRI Facility Solutions.`,
        pitch: `You inspect every floor for fire code — refer the building for $${REFERRAL_FEE}.`,
        icon: '🧯',
        whyYou: `You walk every floor, every stairwell, and every corridor during fire inspections. You see the condition of the building more thoroughly than almost anyone. When the cleaning is subpar, you notice. One referral introduction = $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'You See Every Floor', description: 'Fire inspections take you to every part of the building — lobbies, stairwells, mechanical rooms, offices. That comprehensive view gives you a unique perspective on cleaning quality.' },
            { title: 'Annual and Semi-Annual Touchpoints', description: `Fire protection inspections happen on a regular schedule. Each visit is an opportunity to assess and refer — and each referral is worth $${REFERRAL_FEE} + recurring income.` },
            { title: 'Compliance-Minded Clients Are Ideal', description: 'Building managers who invest in fire protection compliance also invest in cleaning compliance. These are your exact clients — and our exact clients.' },
        ],
        faqs: [
            { question: 'How does the fire protection referral program work?', answer: `Fill out our referral form with the building and contact info. We handle the rest. $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract closes + $${RECURRING_BONUS}/month recurring.` },
            { question: 'What types of buildings should I refer?', answer: 'Any commercial building you inspect: medical offices, professional buildings, retail centers, dental practices, assisted living facilities, and more.' },
        ],
    },
    'elevator-service-referral-partner': {
        title: 'Elevator Service Referral Partner Program',
        h1: `Elevator Companies: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You maintain elevators. We maintain everything else. Refer a building and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `Elevator service referral program — earn $${REFERRAL_FEE} per commercial building referred for cleaning services. Plus $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions.`,
        pitch: `You ride every elevator in the building — refer it for $${REFERRAL_FEE}.`,
        icon: '🛗',
        whyYou: `Elevator maintenance puts you in the lobby of every building on your route. You see the condition of the common areas, the state of the restrooms, and whether the building is well-maintained. That perspective is worth $${REFERRAL_FEE} per referral.`,
        valueProps: [
            { title: 'Lobby-Level Visibility', description: 'You walk through the lobby of every building you service. Dirty lobbies, stained floors, and neglected common areas are obvious to you — and a signal that the building needs better cleaning.' },
            { title: 'Long-Term Building Relationships', description: 'Elevator contracts are multi-year. You know the building managers well. A quick mention of XIRI during your next visit is all it takes.' },
            { title: 'Recurring Revenue on Top of Elevator Contracts', description: `$${REFERRAL_FEE} per referral + $${RECURRING_BONUS}/month recurring. Your elevator route becomes a passive income generator for cleaning referrals.` },
        ],
        faqs: [
            { question: 'How do I refer a building?', answer: `Fill out our online form with the building name and manager contact. We handle the outreach, quoting, and sales. You earn $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} on close.` },
            { question: 'Is there a limit on referrals?', answer: `No cap. Every building that becomes a XIRI cleaning client earns you $${REFERRAL_FEE} + $${RECURRING_BONUS}/month. The more buildings on your route, the more you can earn.` },
        ],
    },
    'locksmith-referral-partner': {
        title: 'Locksmith Referral Partner Program',
        h1: `Commercial Locksmiths: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You secure buildings. We clean them. Refer a commercial property and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month ongoing.`,
        metaDescription: `Commercial locksmith referral program — earn $${REFERRAL_FEE} per building referred for cleaning services. Plus $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `You rekey every door — refer the building for $${REFERRAL_FEE}.`,
        icon: '🔑',
        whyYou: `When tenants move in or out, you're the first call for rekeying and access control. That transition moment is exactly when a new cleaning contract gets signed. You know about it before anyone else — that timing is worth $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'Tenant Transitions = Cleaning Contracts', description: 'Every rekey job signals a new tenant moving in. New tenants need cleaning services. You\'re the first to know about the opportunity.' },
            { title: 'Access Control = Trust', description: 'Building managers trust you with their keys and access codes. That trusts extends to your recommendations — including who should clean the building.' },
            { title: 'Quick Referral, Lasting Income', description: `One conversation during a rekey job → $${REFERRAL_FEE} upfront + $${RECURRING_BONUS}/month for as long as the cleaning contract is active.` },
        ],
        faqs: [
            { question: 'When is the best time to make a referral as a locksmith?', answer: 'During tenant move-in/move-out rekeying. The new tenant needs a cleaning company, and you\'re already on-site.' },
            { question: 'How does the locksmith referral program work?', answer: `Submit the building info through our form. We handle everything else. $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the cleaning contract closes + $${RECURRING_BONUS}/month recurring.` },
        ],
    },
    'property-manager-referral-partner': {
        title: 'Property Manager Referral Partner Program',
        h1: `Property Managers: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You manage buildings. Let us handle the cleaning — and pay you $${REFERRAL_FEE} + $${RECURRING_BONUS}/month for every property you bring us.`,
        metaDescription: `Property manager referral program — earn $${REFERRAL_FEE} per building referred for commercial cleaning. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `You manage the building — we handle the mop. Earn $${REFERRAL_FEE} per property.`,
        icon: '🏢',
        whyYou: `You manage cleaning vendors as part of your job. When the current cleaner isn't performing, you're the one who hires the replacement. Refer XIRI and earn $${REFERRAL_FEE} for every property in your portfolio that we clean.`,
        valueProps: [
            { title: 'One Vendor, Less Headache', description: 'XIRI handles crew scheduling, quality checks, and insurance. You get audit-ready cleaning logs and a single point of contact — reducing your vendor management burden.' },
            { title: 'Portfolio-Scale Income', description: `If you manage 10 buildings and refer 5 to XIRI, that's $${REFERRAL_FEE * 5} upfront + $${RECURRING_BONUS * 5}/month recurring. For properties you already manage.` },
            { title: 'Transparent Reporting', description: 'XIRI provides digital cleaning logs, time-stamped check-ins, and real-time quality scoring. You always know what\'s happening in your buildings.' },
        ],
        faqs: [
            { question: 'Can I refer multiple buildings from my portfolio?', answer: `Yes. There's no cap. Each building that becomes a XIRI cleaning client earns you $${REFERRAL_FEE} + $${RECURRING_BONUS}/month. Property managers with large portfolios can earn significant recurring income.` },
            { question: 'What if I\'m the one who hires the cleaning company?', answer: 'Even better. You\'re both the referrer and the decision-maker. Hire XIRI for the building, and the referral bonus is yours.' },
            { question: 'Does XIRI handle the entire cleaning program?', answer: 'Yes. We supply vetted, insured cleaning crews, provide all equipment and supplies, and manage the schedule. You get a single invoice and a single point of contact.' },
        ],
    },
    'commercial-real-estate-broker-referral-partner': {
        title: 'Commercial Real Estate Broker Referral Program',
        h1: `Commercial RE Brokers: Earn $${REFERRAL_FEE} for Every Tenant You Connect`,
        subtitle: `Every lease signing needs a cleaning company. Refer your tenants to XIRI and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month per building.`,
        metaDescription: `Commercial real estate broker referral program — earn $${REFERRAL_FEE} per tenant referred for cleaning. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `Every new lease needs a cleaner — refer them for $${REFERRAL_FEE}.`,
        icon: '🏗️',
        whyYou: `Every commercial lease you close creates an immediate need for janitorial services. The tenant moves in, the space needs to be cleaned, and they need a recurring cleaning contract. You know about this need weeks before anyone else — and that advance notice is worth $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'Lease Events = Cleaning Contracts', description: 'New lease signings, renewals, expansions — every real estate transaction creates or resets a cleaning contract. You have first-mover advantage on every deal.' },
            { title: 'Post-Close Value-Add', description: 'Helping your tenant find a reliable cleaning company adds value beyond the lease. It strengthens the relationship and increases the likelihood of future business and referrals.' },
            { title: 'Recurring Income Beyond Commission', description: `Brokerage commissions are one-time. XIRI referrals add $${RECURRING_BONUS}/month recurring per building — a steady income stream between deals.` },
        ],
        faqs: [
            { question: 'When should I make a referral as a commercial broker?', answer: 'The best time is during or immediately after lease execution, before the tenant sources their own cleaning vendor. "I know a great cleaning company for your new space" is a natural post-close conversation.' },
            { question: 'What types of properties qualify?', answer: 'Any single-tenant commercial property in Nassau County: office, medical, retail, dental, church, gym, daycare — if it needs recurring cleaning, it qualifies.' },
            { question: 'How does the broker referral program work?', answer: `Submit the tenant and property info via our form. We quote and close the deal. You earn $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract goes live + $${RECURRING_BONUS}/month recurring.` },
        ],
    },
    'accountant-referral-partner': {
        title: 'CPA & Accountant Referral Partner Program',
        h1: `CPAs: Earn $${REFERRAL_FEE} for Every Client You Refer for Cleaning`,
        subtitle: `You see cleaning costs on every P&L. When your client is overpaying, refer XIRI and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `CPA and accountant referral program — earn $${REFERRAL_FEE} per business client referred for commercial cleaning. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions.`,
        pitch: `You see cleaning on every P&L — refer the overcharged ones for $${REFERRAL_FEE}.`,
        icon: '📊',
        whyYou: `You review income statements and expense reports for commercial tenants every month or quarter. You see the "Janitorial" or "Cleaning" line item. When it's disproportionately high, or when your client complains about quality, that's a $${REFERRAL_FEE} referral opportunity.`,
        valueProps: [
            { title: 'You See the Numbers First', description: 'When a client\'s cleaning costs seem high relative to their square footage, you\'re the first to notice. "Have you compared cleaning quotes recently?" is a natural advisory question.' },
            { title: 'Trusted Advisor Status', description: 'Your clients trust your financial recommendations. A cleaning referral from their CPA carries more weight than a cold outreach from a cleaning company.' },
            { title: 'Add Value Beyond the Books', description: `Helping clients reduce operating costs is advisory in action. Referring XIRI when they're overpaying strengthens your relationship and earns you $${REFERRAL_FEE}.` },
        ],
        faqs: [
            { question: 'How does the CPA referral program work?', answer: `When you notice a client overpaying for cleaning or unhappy with their service, submit their info via our form. We quote them, and if they sign, you earn $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract closes + $${RECURRING_BONUS}/month recurring.` },
            { question: 'Is client confidentiality maintained?', answer: 'Yes. You just provide the client name, business name, and contact info with their permission. We never disclose that the referral came from their CPA unless you want us to.' },
            { question: 'What if my client is in Suffolk County?', answer: 'We\'re expanding into Suffolk County. Referrals in both Nassau and Suffolk counties qualify.' },
        ],
    },
    'insurance-agent-referral-partner': {
        title: 'Commercial Insurance Agent Referral Program',
        h1: `Insurance Agents: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You insure the building. We clean it. Refer a commercial client and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `Commercial insurance agent referral program — earn $${REFERRAL_FEE} per building referred for cleaning services. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions.`,
        pitch: `You insure the building — refer it for cleaning and earn $${REFERRAL_FEE}.`,
        icon: '🛡️',
        whyYou: `You review slip-and-fall risk, general liability, and property insurance for commercial buildings. Clean facilities have fewer claims. When a client's building isn't well-maintained, recommending XIRI reduces their risk and earns you $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'Clean Buildings = Fewer Claims', description: 'Slip-and-fall claims are the #1 liability for commercial buildings. Professional cleaning with documented protocols reduces your client\'s risk profile — and your claims exposure.' },
            { title: 'Annual Review Touchpoints', description: 'Policy renewals give you a natural conversation about facility maintenance. "Are you happy with your cleaning company?" is a risk management question — and a referral opportunity.' },
            { title: 'Trusted Risk Advisor', description: 'When you recommend a cleaning company that carries $1M GL and maintains compliance documentation, you\'re adding value as a risk management advisor — not just an insurance salesman.' },
        ],
        faqs: [
            { question: 'How does the insurance agent referral program work?', answer: `Submit your client's building info via our form. We handle quoting and sales. $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract closes + $${RECURRING_BONUS}/month recurring.` },
            { question: 'What insurance does XIRI carry?', answer: 'All XIRI cleaning crews carry $1M general liability, current workers\' compensation, and we provide COIs within 24 hours. This reduces your client\'s vendor-related risk.' },
            { question: 'Does professional cleaning actually reduce insurance claims?', answer: 'Yes. Documented, professional cleaning programs with slip-resistant floor care protocols demonstrably reduce slip-and-fall incidents — the most common commercial liability claim.' },
        ],
    },
    'security-company-referral-partner': {
        title: 'Security Company Referral Partner Program',
        h1: `Security Companies: Earn $${REFERRAL_FEE} for Every Building You Refer`,
        subtitle: `You protect buildings. We clean them. Refer a commercial property and earn $${REFERRAL_FEE} + $${RECURRING_BONUS}/month.`,
        metaDescription: `Security company referral program — earn $${REFERRAL_FEE} per building referred for commercial cleaning. $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions, Nassau County.`,
        pitch: `You watch the building at night — refer it for cleaning and earn $${REFERRAL_FEE}.`,
        icon: '🔒',
        whyYou: `Security patrols and alarm monitoring put you in or near commercial buildings daily. You see the cleaning crews come and go. When the cleaning is poor — or when there's no cleaning at all — you notice before anyone else. That insight is worth $${REFERRAL_FEE}.`,
        valueProps: [
            { title: 'After-Hours Visibility', description: 'Security patrols happen when cleaning happens — after hours. You see the work (or lack of it) firsthand. That makes your referral credible.' },
            { title: 'Building Manager Relationships', description: 'Security contracts require close coordination with building management. You have direct lines to the decision-makers. One mention of XIRI is all it takes.' },
            { title: 'Complementary Night Shift', description: 'Security and cleaning are both after-hours services. Referring doesn\'t compete with your business — it demonstrates that you care about the overall facility.' },
        ],
        faqs: [
            { question: 'How does the security company referral program work?', answer: `Submit building and manager info via our form. We handle outreach and sales. $${WALKTHROUGH_BONUS} for the walkthrough + $${CLOSE_BONUS} when the contract closes + $${RECURRING_BONUS}/month recurring.` },
            { question: 'Can I refer buildings where I do alarm monitoring but not patrol?', answer: 'Yes. Any building where you have a relationship with the manager qualifies, whether you provide patrol, monitoring, access control, or CCTV services.' },
        ],
    },
};

// Locations: reuse LOCATIONS from '@/lib/locations' — no duplication needed.
