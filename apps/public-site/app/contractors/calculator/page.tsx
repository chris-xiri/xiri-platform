import { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import PublicCalculator from '@/components/PublicCalculator';
import { SITE } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Janitorial Bid Calculator (2026) | Free Pricing Tool for Cleaning Companies',
    description: 'Calculate what to charge for janitorial contracts. Enter facility size, type, and state to see competitive bid pricing. Free tool for cleaning companies by XIRI.',
    alternates: {
        canonical: 'https://xiri.ai/contractors/calculator',
    },
    openGraph: {
        title: 'Janitorial Bid Calculator | XIRI Contractor Network',
        description: 'Free bid calculator for cleaning companies. See what janitorial contracts are worth in your area.',
        url: 'https://xiri.ai/contractors/calculator',
        siteName: SITE.name,
        type: 'website',
    },
};

const CONTRACTOR_FAQS = [
    {
        question: 'How do I price a janitorial contract?',
        answer: 'Start with the production rate for the facility type (sqft per hour), calculate total cleaning hours per visit, and multiply by your hourly rate. Our calculator does this automatically — enter the facility details and see what the contract is worth.',
    },
    {
        question: 'What is a good production rate for office cleaning?',
        answer: 'A general office cleans at approximately 4,000–4,500 sqft/hour. Medical facilities are slower at 1,750–2,500 sqft/hour due to disinfection. Retail is fastest at ~4,750 sqft/hour. These rates assume a trained cleaner with proper equipment.',
    },
    {
        question: 'How do floor types affect my bid?',
        answer: 'Carpet vacuums fastest. Resilient floors (VCT, LVT, vinyl) require dust mopping and wet mopping. Tile and stone floors with grout lines take the most time. A facility that is 100% tile/stone will take longer than one that is 100% carpet, so your bid should reflect that.',
    },
    {
        question: 'Should I charge more for daytime cleaning?',
        answer: 'Yes. Daytime cleaning typically costs 10–15% more because cleaners must work around occupants, which slows production. Weekend shifts carry a 20–25% premium. Our calculator includes these shift modifiers automatically.',
    },
    {
        question: 'What is the minimum hours for a janitorial visit?',
        answer: 'Industry standard is a 1-hour minimum per visit, even for small spaces. Travel time, setup, and restocking supplies make shorter visits uneconomical for both the contractor and the client.',
    },
    {
        question: 'How do I get janitorial contracts?',
        answer: 'Join XIRI\'s contractor network to get matched with facilities in your area. We handle client acquisition, invoicing, and quality management — you focus on cleaning. Use this calculator to understand what contracts are worth, then apply to join our network.',
    },
];

export default function ContractorCalculatorPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* JSON-LD */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: CONTRACTOR_FAQS.map(faq => ({
                        '@type': 'Question',
                        name: faq.question,
                        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                    })),
                }}
            />
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    name: 'Janitorial Bid Calculator',
                    url: 'https://xiri.ai/contractors/calculator',
                    applicationCategory: 'BusinessApplication',
                    operatingSystem: 'Web',
                    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                    author: { '@type': 'Organization', name: SITE.name },
                }}
            />
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: 'Janitorial Bid Calculator (2026) — Free Pricing Tool for Cleaning Companies',
                    description: 'Calculate what to charge for janitorial contracts. Enter facility size, type, and state to see competitive bid pricing.',
                    author: { '@type': 'Organization', name: SITE.name },
                    publisher: { '@type': 'Organization', name: SITE.name },
                    datePublished: '2025-03-01',
                    dateModified: '2026-03-05',
                    mainEntityOfPage: 'https://xiri.ai/contractors/calculator',
                }}
            />

            {/* ═══ HERO ═══ */}
            <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white py-10 sm:py-20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-semibold mb-6 border border-emerald-500/30">
                        Free Tool for Cleaning Companies
                    </div>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 leading-tight">
                        Janitorial Bid Calculator
                    </h1>
                    <p className="text-xl text-emerald-200 max-w-2xl mx-auto">
                        See what recurring janitorial contracts are worth in your area.
                        Price your bids accurately with real market data.
                    </p>
                    <p className="text-sm text-emerald-300/60 mt-3">
                        For nightly/weekly maintenance contracts. Not for post-construction or one-time deep cleans.
                    </p>
                </div>
            </section>

            {/* ═══ CALCULATOR ═══ */}
            <section className="py-12 bg-slate-50 border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4">
                    <PublicCalculator mode="contractor" />
                </div>
            </section>

            {/* ═══ BIDDING TIPS ═══ */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                        How to Price Janitorial Contracts
                    </h2>
                    <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
                        Stop guessing. Use production rates and floor-type analysis to build accurate, profitable bids every time.
                    </p>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">⏱️</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Calculate Hours First</h3>
                            <p className="text-slate-600 text-sm">
                                The biggest bidding mistake is guessing hours. Use production rates: a 10,000 sqft office at 4,250 sqft/hr = 2.35 hours. Add fixture time and you have your bid foundation.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">💰</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Know Your Market Rate</h3>
                            <p className="text-slate-600 text-sm">
                                Rates vary massively by state. A $50/hr bid in New York is competitive, but in Texas the same bid is premium. Our calculator adjusts automatically for your state&apos;s labor market.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <div className="text-3xl mb-3">📋</div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Factor Everything In</h3>
                            <p className="text-slate-600 text-sm">
                                Don&apos;t forget: restroom fixtures (3 min each), trash bins (1 min each), floor type mix, and shift premiums. Missing these can cost you 20%+ on every contract.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 mb-10 text-center">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {CONTRACTOR_FAQS.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══ */}
            <section className="py-20 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white">
                <div className="max-w-2xl mx-auto px-4 text-center">
                    <div className="text-4xl mb-4">🧹</div>
                    <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Cleaning Business?</h2>
                    <p className="text-emerald-200 text-lg mb-8">
                        Join XIRI&apos;s contractor network. We match you with facilities, handle invoicing, and manage quality — you focus on cleaning.
                    </p>
                    <a
                        href="/contractors"
                        className="inline-block bg-white text-emerald-800 px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-colors shadow-xl"
                    >
                        See Available Jobs in Your Area →
                    </a>
                    <p className="text-emerald-300/60 text-sm mt-4">
                        Fully insured contractors earn competitive rates with guaranteed pay.
                    </p>
                </div>
            </section>
        </div>
    );
}
