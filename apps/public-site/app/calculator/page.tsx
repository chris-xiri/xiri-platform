import { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import PublicCalculator from '@/components/PublicCalculator';

export const metadata: Metadata = {
    title: 'Janitorial Cleaning Cost Calculator (2025) | Free Instant Estimate',
    description: 'Calculate recurring janitorial cleaning costs in seconds. Enter your square footage, facility type, and state for an instant estimate. For nightly/weekly maintenance — not one-time or post-construction cleaning. Free tool by XIRI Facility Solutions.',
    alternates: {
        canonical: 'https://xiri.ai/calculator',
    },
    openGraph: {
        title: 'Janitorial Cleaning Cost Calculator | XIRI Facility Solutions',
        description: 'Free instant estimate for commercial cleaning. Enter your sqft and facility type to see what janitorial services should cost.',
        url: 'https://xiri.ai/calculator',
        siteName: 'XIRI Facility Solutions',
        type: 'website',
    },
};

const FAQS = [
    {
        question: 'How much does commercial cleaning cost per square foot?',
        answer: 'Recurring janitorial cleaning typically costs $0.05–$0.25 per square foot per visit, depending on the facility type, floor surfaces, cleaning frequency, and your state. A 10,000 sqft office cleaned 5x/week in New York costs approximately $2,500–$4,500/month. Note: this calculator covers routine maintenance cleaning — not one-time deep cleans or post-construction cleanup, which are priced separately.',
    },
    {
        question: 'How is janitorial cleaning priced?',
        answer: 'Professional janitorial services are priced by estimated hours per visit. We calculate hours based on your square footage, production rate for your facility type, number of restroom fixtures, trash bins, floor types, and any add-on services. The hourly rate varies by state based on local labor costs.',
    },
    {
        question: 'Why does facility type affect cleaning cost?',
        answer: 'Different facilities require different levels of care. Medical offices need OSHA-compliant disinfection protocols and take longer per sqft than general offices. Retail spaces with high foot traffic need more frequent attention. Our production rates reflect these real-world differences.',
    },
    {
        question: 'How often should my office be cleaned?',
        answer: 'Most offices are cleaned 5 nights per week (Monday–Friday). Medical facilities typically require nightly cleaning. Smaller offices or low-traffic spaces may only need 2–3 times per week. The frequency directly impacts your monthly cost.',
    },
    {
        question: 'What affects the cost of cleaning different floor types?',
        answer: 'Carpet is the fastest to clean (vacuum only). Resilient floors like VCT and LVT require dust mopping and wet mopping. Tile and stone floors (ceramic, terrazzo, marble) are the most time-intensive due to grout lines and special care requirements.',
    },
    {
        question: 'Why do cleaning costs vary by state?',
        answer: 'Janitorial labor costs are directly tied to state minimum wage laws. States like New York ($20/hr) and California ($16.50/hr) have higher costs than states using the federal minimum of $7.25/hr. Our calculator adjusts all rates proportionally for your state.',
    },
    {
        question: 'Are these estimates accurate?',
        answer: 'Our calculator provides estimates within ±20% of actual costs. The final price depends on a site walkthrough where we assess the exact scope of work, accessibility, special requirements, and any compliance needs specific to your facility.',
    },
    {
        question: 'How can I get an exact quote?',
        answer: 'Click "Get Your Custom Quote" below and we\'ll schedule a free site walkthrough. We\'ll walk your facility, document the exact scope, and provide a fixed monthly price — no surprises.',
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
                        Get an instant estimate for recurring janitorial cleaning services.
                        Enter your facility details below — results update in real-time.
                    </p>
                    <p className="text-sm text-slate-400 mt-3">
                        For nightly/weekly maintenance cleaning. Not for post-construction, deep cleans, or one-time services.
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
