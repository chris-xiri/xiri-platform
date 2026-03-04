import { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import PublicCalculator from '@/components/PublicCalculator';

export const metadata: Metadata = {
    title: 'Janitorial Cleaning Cost Calculator (2026) | Commercial Cleaning Rates',
    description: 'How much does janitorial cleaning cost? Use our free calculator to get instant commercial cleaning rates by sqft, facility type, and state. Compare office cleaning costs, janitorial services pricing, and get an accurate estimate in seconds.',
    alternates: {
        canonical: 'https://xiri.ai/calculator',
    },
    keywords: ['janitorial cleaning cost', 'janitorial services cost', 'commercial cleaning rates', 'office cleaning cost', 'janitorial cleaning cost calculator', 'commercial cleaning cost per square foot'],
    openGraph: {
        title: 'Janitorial Cleaning Cost Calculator (2026) | Free Instant Estimate',
        description: 'How much do janitorial services cost? Free calculator for commercial cleaning rates — office, medical, auto dealership & more. Instant estimate by sqft and state.',
        url: 'https://xiri.ai/calculator',
        siteName: 'XIRI Facility Solutions',
        type: 'website',
    },
};

const FAQS = [
    {
        question: 'How much does janitorial cleaning cost?',
        answer: 'Janitorial cleaning costs typically range from $0.05 to $0.25 per square foot per visit, or $1,200 to $4,500 per month for a 10,000 sqft facility cleaned 5x/week. The exact cost depends on your facility type, location, cleaning frequency, floor surfaces, and number of restrooms. Medical offices cost more due to OSHA disinfection requirements, while general offices are the most affordable. Use our calculator above for an instant estimate tailored to your facility.',
    },
    {
        question: 'How much do janitorial services cost per month?',
        answer: 'Monthly janitorial services costs depend on building size and cleaning frequency. A small office (2,000–5,000 sqft) typically costs $600–$1,500/month. A mid-size facility (5,000–15,000 sqft) runs $1,500–$4,000/month. Large facilities (15,000–50,000+ sqft) range from $3,500–$10,000+/month. These figures assume 5x/week cleaning in a mid-cost state — higher-wage states like New York and California cost proportionally more.',
    },
    {
        question: 'What are average commercial cleaning rates?',
        answer: 'Average commercial cleaning rates range from $25–$75 per hour per cleaner, or $0.05–$0.25 per square foot per visit. Monthly contracts for recurring janitorial service typically run $0.10–$0.35/sqft/month depending on frequency and facility type. The most common pricing model for commercial cleaning is per-square-foot, which makes it easy to compare bids. Our calculator uses production-rate-based pricing — the same method professional cleaning companies use to build bids.',
    },
    {
        question: 'How much does office cleaning cost?',
        answer: 'Office cleaning costs range from $0.08–$0.18 per square foot per visit for a standard general office. A typical 10,000 sqft office cleaned 5 nights per week costs $2,000–$3,600/month. Key factors that affect office cleaning cost include: number of restrooms and kitchens, floor type (carpet vs. tile vs. VCT), shift timing (after-hours vs. daytime), and whether high-touch disinfection is required. Smaller offices under 3,000 sqft often have a per-visit minimum of $75–$150.',
    },
    {
        question: 'How much does commercial cleaning cost per square foot?',
        answer: 'Recurring janitorial cleaning typically costs $0.05–$0.25 per square foot per visit, depending on the facility type, floor surfaces, cleaning frequency, and your state. A 10,000 sqft office cleaned 5x/week in New York costs approximately $2,500–$4,500/month. This calculator covers routine maintenance cleaning — not one-time deep cleans or post-construction cleanup, which are priced separately.',
    },
    {
        question: 'How is janitorial cleaning priced?',
        answer: 'Professional janitorial services are priced by estimated hours per visit. We calculate hours based on your square footage, production rate for your facility type, number of restroom fixtures, trash bins, floor types, and any add-on services. The hourly rate varies by state based on local labor costs. Most cleaning companies use either per-sqft, per-hour, or flat monthly pricing — our calculator shows you what a fair per-visit and monthly rate should be.',
    },
    {
        question: 'Why does facility type affect cleaning cost?',
        answer: 'Different facilities require different levels of care. Medical offices need OSHA-compliant disinfection protocols and take longer per sqft than general offices. Retail spaces with high foot traffic need more frequent attention. Auto dealership showrooms require high-gloss floor care. Daycares need child-safe, green-certified products. Our production rates reflect these real-world differences — a medical office takes nearly twice as long to clean per sqft as a general office.',
    },
    {
        question: 'How often should my office be cleaned?',
        answer: 'Most offices are cleaned 5 nights per week (Monday–Friday). Medical facilities typically require nightly cleaning. Smaller offices or low-traffic spaces may only need 2–3 times per week. The frequency directly impacts your monthly cost — cleaning 3x/week instead of 5x/week can save 30–40% on monthly costs, but each visit costs slightly more since the facility accumulates more dirt between visits.',
    },
    {
        question: 'What affects the cost of cleaning different floor types?',
        answer: 'Carpet is the fastest to clean (vacuum only). Resilient floors like VCT and LVT require dust mopping and wet mopping. Tile and stone floors (ceramic, terrazzo, marble) are the most time-intensive due to grout lines and special care requirements. A facility that is 100% carpet will be 15–25% cheaper to clean than one with primarily hard floors.',
    },
    {
        question: 'Why do cleaning costs vary by state?',
        answer: 'Janitorial labor costs are directly tied to state minimum wage laws and local cost of living. States like New York ($20/hr) and California ($16.50/hr) have higher cleaning costs than states using the federal minimum of $7.25/hr. A 10,000 sqft office that costs $3,200/month in New York might cost only $1,800/month in Texas. Our calculator adjusts all rates proportionally for your state.',
    },
    {
        question: 'Is it cheaper to hire a cleaner or a janitorial service?',
        answer: 'Hiring a janitorial service is typically more cost-effective than an in-house cleaner for facilities under 50,000 sqft. An in-house cleaner costs $35,000–$50,000/year in salary plus benefits, workers comp, supplies, and equipment — roughly $4,000–$6,000/month all-in. A professional janitorial service for a 10,000 sqft office runs $2,000–$4,000/month and includes trained staff, supplies, insurance, and backup coverage if someone calls out.',
    },
    {
        question: "What's the difference between janitorial and commercial cleaning?",
        answer: 'Janitorial cleaning refers to recurring, routine maintenance — daily trash, vacuuming, restroom cleaning, and surface wiping. Commercial cleaning is a broader term that includes janitorial plus periodic services like carpet extraction, floor stripping/waxing, window washing, and power washing. This calculator estimates recurring janitorial costs. Periodic commercial cleaning services are typically quoted separately based on scope.',
    },
    {
        question: 'Are these estimates accurate?',
        answer: 'Our calculator provides estimates within ±20% of actual costs. The final price depends on a site walkthrough where we assess the exact scope of work, accessibility, special requirements, and any compliance needs specific to your facility.',
    },
];

const AVG_COSTS = [
    { type: 'General Office', sqft: '5,000', low: '$1,200', high: '$2,100', notes: 'Most common' },
    { type: 'General Office', sqft: '10,000', low: '$2,000', high: '$3,600', notes: '' },
    { type: 'General Office', sqft: '25,000', low: '$4,200', high: '$7,600', notes: '' },
    { type: 'Medical Office', sqft: '3,000', low: '$1,600', high: '$2,900', notes: 'OSHA compliant' },
    { type: 'Medical Office', sqft: '8,000', low: '$3,200', high: '$5,700', notes: '' },
    { type: 'Dental Office', sqft: '2,500', low: '$1,400', high: '$2,500', notes: '' },
    { type: 'Auto Showroom', sqft: '15,000', low: '$3,000', high: '$5,400', notes: 'High-gloss floors' },
    { type: 'Daycare', sqft: '4,000', low: '$1,600', high: '$2,900', notes: 'Green Seal products' },
    { type: 'Retail Store', sqft: '3,000', low: '$800', high: '$1,400', notes: 'High-traffic' },
    { type: 'Fitness / Gym', sqft: '8,000', low: '$2,400', high: '$4,200', notes: 'Locker rooms' },
];

export default function CalculatorPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* JSON-LD: FAQPage */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: FAQS.map(faq => ({
                        '@type': 'Question',
                        name: faq.question,
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: faq.answer,
                        },
                    })),
                }}
            />
            {/* JSON-LD: WebApplication */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    name: 'Janitorial Cleaning Cost Calculator',
                    url: 'https://xiri.ai/calculator',
                    applicationCategory: 'BusinessApplication',
                    operatingSystem: 'Web',
                    offers: {
                        '@type': 'Offer',
                        price: '0',
                        priceCurrency: 'USD',
                    },
                    author: {
                        '@type': 'Organization',
                        name: 'XIRI Facility Solutions',
                    },
                }}
            />
            {/* JSON-LD: Article */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: 'How Much Does Janitorial Cleaning Cost in 2026?',
                    description: 'Complete guide to janitorial services cost, commercial cleaning rates, and office cleaning pricing. Free interactive calculator included.',
                    datePublished: '2025-03-01',
                    dateModified: '2026-03-04',
                    author: {
                        '@type': 'Organization',
                        name: 'XIRI Facility Solutions',
                        url: 'https://xiri.ai',
                    },
                    publisher: {
                        '@type': 'Organization',
                        name: 'XIRI Facility Solutions',
                        url: 'https://xiri.ai',
                    },
                    mainEntityOfPage: 'https://xiri.ai/calculator',
                }}
            />

            {/* ═══ HERO ═══ */}
            <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white py-20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-sky-500/20 text-sky-300 text-sm font-semibold mb-6 border border-sky-500/30">
                        Free Tool — No Sign-up Required
                    </div>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 leading-tight">
                        Janitorial Cleaning Cost Calculator
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                        How much do janitorial services cost? Get instant commercial cleaning rates
                        for your office, medical facility, or commercial space — updated for 2026.
                    </p>
                    <p className="text-sm text-slate-400 mt-3">
                        Free tool — no sign-up required. For recurring maintenance cleaning, not one-time or post-construction services.
                    </p>
                </div>
            </section>

            {/* ═══ CALCULATOR ═══ */}
            <section className="py-12 bg-slate-50 border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4">
                    <PublicCalculator />
                </div>
            </section>

            {/* ═══ HOW WE CALCULATE ═══ */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                        How We Calculate Janitorial Costs
                    </h2>
                    <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
                        Our calculator uses the same methodology professional cleaning companies use to build bids — production rates, fixture counts, and floor-type analysis.
                    </p>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">📐</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Production Rates</h3>
                            <p className="text-slate-600 text-sm">
                                Each facility type has a production rate (sqft/hour) based on cleaning intensity.
                                Medical offices need more time per sqft than general offices due to disinfection protocols.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">🚿</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Fixture Counts</h3>
                            <p className="text-slate-600 text-sm">
                                Restroom fixtures (toilets, sinks, urinals) add 3 minutes each. Trash bins add 1 minute each.
                                These are counted separately because they scale independently of sqft.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">🏗️</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Floor Types</h3>
                            <p className="text-slate-600 text-sm">
                                Carpet vacuums fastest. Resilient floors (VCT, LVT) need mopping. Tile &amp; stone
                                require grout care. Your floor mix directly impacts cleaning time and cost.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ AVERAGE COSTS TABLE ═══ */}
            <section className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                        Average Janitorial Costs by Facility Type
                    </h2>
                    <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-10">
                        Monthly estimates for 5x/week cleaning in New York. Costs vary ±20% based on scope.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left bg-white">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="px-4 py-3 text-sm font-semibold">Facility Type</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-right">Sqft</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-right">Low</th>
                                    <th className="px-4 py-3 text-sm font-semibold text-right">High</th>
                                    <th className="px-4 py-3 text-sm font-semibold">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {AVG_COSTS.map((row, i) => (
                                    <tr key={i} className="hover:bg-sky-50/50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.type}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.sqft}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{row.low}/mo</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{row.high}/mo</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{row.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-4">
                        Based on New York (high-cost market) rates. Adjust to your state using the calculator above.
                    </p>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="py-20 bg-white">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-10 text-center">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {FAQS.map((faq, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ DUAL CTA ═══ */}
            <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* For facility managers */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                            <div className="text-3xl mb-4">🏢</div>
                            <h3 className="text-xl font-bold mb-3">For Facility Managers</h3>
                            <p className="text-slate-300 mb-6 text-sm">
                                Get an exact quote with a free site walkthrough. We&apos;ll walk your facility, build a custom scope, and match you with vetted, insured contractors.
                            </p>
                            <CTAButton
                                href="/#audit"
                                text="Get Your Custom Quote →"
                                className="inline-block bg-sky-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-400 transition-colors"
                            />
                        </div>
                        {/* For cleaning companies */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                            <div className="text-3xl mb-4">🧹</div>
                            <h3 className="text-xl font-bold mb-3">For Cleaning Companies</h3>
                            <p className="text-slate-300 mb-6 text-sm">
                                Use this tool to bid more accurately. Join XIRI&apos;s contractor network to get matched with facilities in your area — we handle invoicing, you handle cleaning.
                            </p>
                            <CTAButton
                                href="/contractors"
                                text="Join Our Network →"
                                className="inline-block bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
