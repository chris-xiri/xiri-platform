import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { REFERRAL_PARTNERS, REFERRAL_FEE, RECURRING_BONUS, WALKTHROUGH_BONUS, CLOSE_BONUS, ICP_QUALIFICATIONS, GENERAL_FAQS } from '@/data/dlp-referral-partners';
import { LOCATIONS } from '@/lib/locations';
import ReferralForm from '@/components/ReferralForm';
import { FAQ } from '@/components/FAQ';
import { JsonLd } from '@/components/JsonLd';
import { SITE } from '@/lib/constants';
import { ArrowRight, CheckCircle, DollarSign, Building2, Handshake, XCircle } from 'lucide-react';

type Props = { params: Promise<{ slug: string }> };

// ─── Parse slug: trade-only or trade-in-location ─────────────────────
function parseSlug(slug: string) {
    if (REFERRAL_PARTNERS[slug]) {
        return { partner: REFERRAL_PARTNERS[slug], partnerSlug: slug, location: null };
    }
    for (const loc of LOCATIONS) {
        const suffix = `-in-${loc.slug}`;
        if (slug.endsWith(suffix)) {
            const partnerSlug = slug.slice(0, slug.length - suffix.length);
            const partner = REFERRAL_PARTNERS[partnerSlug];
            if (partner) return { partner, partnerSlug, location: loc };
        }
    }
    return null;
}

// ─── Static params (12 trades × 15 locations + 12 direct) ───────────
export async function generateStaticParams() {
    const partnerSlugs = Object.keys(REFERRAL_PARTNERS);
    const direct = partnerSlugs.map(slug => ({ slug }));
    const cross = partnerSlugs.flatMap(p =>
        LOCATIONS.map(l => ({ slug: `${p}-in-${l.slug}` }))
    );
    return [...direct, ...cross];
}

// ─── Metadata ────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const parsed = parseSlug(slug);
    if (!parsed) return {};
    const { partner, location } = parsed;

    const locationSuffix = location ? ` in ${location.city}` : ' in Nassau County';
    const title = `${partner.title}${locationSuffix} | ${SITE.name}`;

    // Location-specific meta description for Google uniqueness
    const description = location
        ? `${partner.title.replace('Referral Partner', '')}in ${location.city}, ${location.state}: earn $${REFERRAL_FEE}+ referring commercial buildings for cleaning. ${location.city} tradespeople earn $${WALKTHROUGH_BONUS} per walkthrough + $${RECURRING_BONUS}/mo recurring. Join XIRI's referral network.`.slice(0, 155)
        : partner.metaDescription;

    return {
        title,
        description,
        alternates: { canonical: `${SITE.url}/refer/${slug}` },
        openGraph: { title, description, url: `${SITE.url}/refer/${slug}`, siteName: SITE.name, type: 'website' },
    };
}

// ─── Page ────────────────────────────────────────────────────────────
export default async function ReferralPartnerPage({ params }: Props) {
    const { slug } = await params;
    const parsed = parseSlug(slug);
    if (!parsed) notFound();
    const { partner, partnerSlug, location } = parsed;

    const locationName = location ? location.city : 'Nassau County';
    const h1 = location
        ? partner.h1.replace(/Nassau County|Long Island/i, location.city)
        : partner.h1;

    // Merge trade-specific + general FAQs (dedupe by question)
    const allFaqs = [...partner.faqs, ...GENERAL_FAQS.filter(g => !partner.faqs.some(p => p.question === g.question))];

    return (
        <div className="min-h-screen bg-white">
            {/* JSON-LD */}
            <JsonLd data={{
                '@context': 'https://schema.org', '@type': 'WebPage',
                name: partner.title, description: partner.metaDescription,
                url: `${SITE.url}/refer/${slug}`,
            }} />
            <JsonLd data={{
                '@context': 'https://schema.org', '@type': 'FAQPage',
                mainEntity: allFaqs.map(f => ({
                    '@type': 'Question', name: f.question,
                    acceptedAnswer: { '@type': 'Answer', text: f.answer },
                })),
            }} />

            {/* Hero */}
            <section className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 bg-white/10 text-emerald-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
                            <DollarSign className="w-4 h-4" />
                            Referral Partner Program — {locationName}
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
                            {h1}
                        </h1>
                        <p className="text-lg sm:text-xl text-emerald-100 leading-relaxed max-w-2xl mb-8">
                            {partner.subtitle}
                        </p>

                        {/* Fee highlight */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20">
                                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Per Referral (min.)</p>
                                <p className="text-3xl font-black">${REFERRAL_FEE}+</p>
                                <p className="text-emerald-200 text-sm">after 60 days active</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20">
                                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Recurring Bonus</p>
                                <p className="text-3xl font-black">${RECURRING_BONUS}<span className="text-lg font-normal">/mo</span></p>
                                <p className="text-emerald-200 text-sm">for life of contract</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 border border-white/20">
                                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">5 Referrals / Year</p>
                                <p className="text-3xl font-black">$5,500<span className="text-lg font-normal">+</span></p>
                                <p className="text-emerald-200 text-sm">passive income</p>
                            </div>
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
                            { step: '1', title: 'Refer a Building', desc: 'Fill out the form below with the building name and manager contact. Takes 60 seconds.', icon: Building2 },
                            { step: '2', title: 'We Win the Contract', desc: 'XIRI quotes, sells, and closes the cleaning contract. You do nothing else.', icon: Handshake },
                            { step: '3', title: 'You Get Paid', desc: `$${WALKTHROUGH_BONUS} when we do the walkthrough. $${CLOSE_BONUS} when we close. Then $${RECURRING_BONUS}/month recurring.`, icon: DollarSign },
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

            {/* Why You + Value Props + Form */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                    <div className="lg:col-span-3">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Why You&apos;re the Perfect Referral Partner</h2>
                        <p className="text-slate-600 leading-relaxed mb-8">{partner.whyYou}</p>

                        <div className="space-y-6">
                            {partner.valueProps.map((vp, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                                        <CheckCircle className="w-4 h-4 text-emerald-700" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">{vp.title}</h3>
                                        <p className="text-sm text-slate-600 leading-relaxed">{vp.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Earnings table */}
                        <div className="mt-10 bg-slate-50 rounded-2xl p-6 border border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-4">Potential Earnings</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-slate-500 uppercase border-b">
                                            <th className="pb-2 font-semibold">Referrals</th>
                                            <th className="pb-2 font-semibold">Upfront</th>
                                            <th className="pb-2 font-semibold">Monthly</th>
                                            <th className="pb-2 font-semibold">Year 1 Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {[1, 3, 5, 10].map(n => (
                                            <tr key={n} className="border-b border-slate-100">
                                                <td className="py-2 font-medium">{n} building{n > 1 ? 's' : ''}</td>
                                                <td className="py-2">${(n * REFERRAL_FEE).toLocaleString()}</td>
                                                <td className="py-2">${(n * RECURRING_BONUS).toLocaleString()}/mo</td>
                                                <td className="py-2 font-bold text-emerald-700">
                                                    ${((n * REFERRAL_FEE) + (n * RECURRING_BONUS * 10)).toLocaleString()}+
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Year 1 assumes 10 months of recurring after 60-day holdback.</p>
                        </div>
                    </div>

                    {/* Sticky form */}
                    <div className="lg:col-span-2">
                        <div className="lg:sticky lg:top-24">
                            <ReferralForm tradeSlug={partnerSlug} source={slug} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ICP Qualification — Commercial Only */}
            <section className="border-t border-slate-200 bg-slate-50">
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

            {/* FAQ — trade-specific + general */}
            <section className="border-t border-slate-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
                    <FAQ items={allFaqs} hideTitle />
                </div>
            </section>

            {/* CTA */}
            <section className="bg-emerald-700 text-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
                    <h2 className="text-2xl font-bold mb-3">Ready to Earn?</h2>
                    <p className="text-emerald-100 mb-6">
                        Fill out the form above or call us directly at{' '}
                        <a href="tel:+15163990350" className="underline font-semibold text-white">(516) 399-0350</a>
                    </p>
                    <Link
                        href="/refer"
                        className="inline-flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition-colors"
                    >
                        View All Partner Programs <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
