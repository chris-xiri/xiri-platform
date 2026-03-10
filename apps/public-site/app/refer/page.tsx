import { Metadata } from 'next';
import Link from 'next/link';
import { REFERRAL_PARTNERS, REFERRAL_FEE, RECURRING_BONUS, ICP_QUALIFICATIONS, GENERAL_FAQS } from '@/data/dlp-referral-partners';
import ReferralForm from '@/components/ReferralForm';
import { FAQ } from '@/components/FAQ';
import { SITE } from '@/lib/constants';
import { DollarSign, ArrowRight, Building2, Handshake, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: `Refer & Earn $${REFERRAL_FEE} Per Building | ${SITE.name}`,
    description: `Earn $${REFERRAL_FEE} for every commercial building you refer for cleaning. Plus $${RECURRING_BONUS}/month recurring bonus. Open to plumbers, electricians, HVAC, property managers, and more.`,
    alternates: { canonical: `${SITE.url}/refer` },
    openGraph: {
        title: `Refer & Earn $${REFERRAL_FEE} Per Building`,
        description: `Earn $${REFERRAL_FEE} for every commercial building you refer. Plus $${RECURRING_BONUS}/month recurring. XIRI Facility Solutions.`,
        url: `${SITE.url}/refer`,
        siteName: SITE.name,
        type: 'website',
    },
};

export default function ReferralHubPage() {
    const partners = Object.entries(REFERRAL_PARTNERS);

    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 text-emerald-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
                        <DollarSign className="w-4 h-4" />
                        Referral Partner Program
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
                        Earn a Minimum of ${REFERRAL_FEE} for Every Building You Refer
                    </h1>
                    <p className="text-lg sm:text-xl text-emerald-100 leading-relaxed max-w-2xl mx-auto mb-8">
                        You service commercial buildings. We clean them. Refer a building and earn a minimum of ${REFERRAL_FEE} upfront + ${RECURRING_BONUS}/month for the life of the contract.
                    </p>

                    {/* Fee cards */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20 flex-1">
                            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Per Referral (min.)</p>
                            <p className="text-3xl font-black">${REFERRAL_FEE}+</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20 flex-1">
                            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Monthly Recurring</p>
                            <p className="text-3xl font-black">${RECURRING_BONUS}<span className="text-lg font-normal">/mo</span></p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20 flex-1">
                            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">No Cap</p>
                            <p className="text-3xl font-black">∞</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="bg-slate-50 border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">How It Works</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {[
                            { step: '1', title: 'Refer a Building', desc: 'Fill out the form with the building info. Takes 60 seconds.', icon: Building2 },
                            { step: '2', title: 'We Win the Contract', desc: 'XIRI quotes, sells, and closes. You do zero selling.', icon: Handshake },
                            { step: '3', title: 'You Get Paid', desc: `$${REFERRAL_FEE} after 60 days. Then $${RECURRING_BONUS}/month recurring.`, icon: DollarSign },
                        ].map(({ step, title, desc, icon: Icon }) => (
                            <div key={step} className="text-center">
                                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                                    <Icon className="w-6 h-6 text-emerald-700" />
                                </div>
                                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Step {step}</div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                                <p className="text-sm text-slate-600">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Partner Types Grid */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Who Can Refer?</h2>
                <p className="text-slate-500 text-center mb-10 max-w-xl mx-auto">
                    Any professional who services commercial buildings in Nassau County. Click your trade to learn more.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {partners.map(([slug, partner]) => (
                        <Link
                            key={slug}
                            href={`/refer/${slug}`}
                            className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{partner.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm">
                                        {partner.title.replace(' Referral Partner Program', '').replace(' Referral Program', '')}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        {partner.pitch}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors flex-shrink-0 mt-1" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Why XIRI */}
            <section className="bg-slate-50 border-y border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Why Refer to XIRI?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        {[
                            { title: 'We Close Deals', desc: 'You make the intro — we handle quoting, negotiation, and contract execution. Zero selling on your end.' },
                            { title: 'Professional Service', desc: 'Vetted crews, $1M liability insurance, audit-ready cleaning logs. Your referral reflects well on you.' },
                            { title: 'Recurring Revenue', desc: `$${RECURRING_BONUS}/month for as long as the contract stays active. Five referrals = $${5 * RECURRING_BONUS}/month passive income.` },
                            { title: 'No Competition', desc: 'We clean — you do your trade. Referring cleaning doesn\'t take business from you. It strengthens your client relationships.' },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                                    <p className="text-sm text-slate-600 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ICP Qualification — Commercial Only */}
            <section className="border-y border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">{ICP_QUALIFICATIONS.headline}</h2>
                    <p className="text-slate-500 text-center mb-8 max-w-xl mx-auto">{ICP_QUALIFICATIONS.subheadline}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                        {ICP_QUALIFICATIONS.buildingTypes.map((bt, i) => (
                            <div key={i} className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                                <span className="text-2xl">{bt.icon}</span>
                                <p className="text-xs font-medium text-slate-700 mt-1">{bt.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 max-w-2xl mx-auto">
                        <div className="flex-1 bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">✓ Good Fit</p>
                            <ul className="text-sm text-slate-700 space-y-1">
                                <li>• Single-tenant commercial buildings</li>
                                <li>• {ICP_QUALIFICATIONS.sizeRange}</li>
                                <li>• {ICP_QUALIFICATIONS.geography}</li>
                            </ul>
                        </div>
                        <div className="flex-1 bg-red-50 rounded-xl p-4 border border-red-200">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">✗ Not a Fit</p>
                            <ul className="text-sm text-slate-700 space-y-1">
                                {ICP_QUALIFICATIONS.notAFit.map((item, i) => (
                                    <li key={i}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="bg-slate-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
                    <FAQ items={GENERAL_FAQS} />
                </div>
            </section>

            {/* Generic Referral Form */}
            <section className="max-w-xl mx-auto px-4 sm:px-6 py-16">
                <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Refer a Building Now</h2>
                <p className="text-slate-500 text-center mb-8">
                    Don&apos;t see your trade above? Use this form — anyone can refer.
                </p>
                <ReferralForm source="hub" />
            </section>
        </div>
    );
}
