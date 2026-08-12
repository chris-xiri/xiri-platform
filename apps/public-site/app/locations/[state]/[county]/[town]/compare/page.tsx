import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLocationBySlugs } from '@/lib/location-utils';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { SITE } from '@/lib/constants';
import { CheckCircle2, Shield, Users, Clock, AlertTriangle, Building2 } from 'lucide-react';

type Props = {
    params: Promise<{
        state: string;
        county: string;
        town: string;
    }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { state, county, town } = await params;
    const location = getLocationBySlugs(state, county, town);
    if (!location) return {};

    const townName = location.name.split(',')[0];
    return {
        title: `Best Commercial & Medical Cleaning Options in ${townName}, NY | Provider Comparison`,
        description: `Compare commercial cleaning options in ${townName}, ${state.toUpperCase()}. Evaluate Xiri Facility Solutions vs independent cleaners and national franchises on compliance, insurance, and night audits.`,
        keywords: [
            `best commercial cleaning companies ${townName} ny`,
            `janitorial services comparison ${townName}`,
            `medical office cleaning options ${townName}`,
            `top commercial cleaning ${townName} ${location.region}`,
        ],
        alternates: {
            canonical: `https://xiri.ai/locations/${state}/${county}/${town}/compare`,
        },
    };
}

export default async function TownComparisonPage({ params }: Props) {
    const { state, county, town } = await params;
    const location = getLocationBySlugs(state, county, town);

    if (!location) {
        notFound();
    }

    const townName = location.name.split(',')[0];
    const countyName = location.region;

    const COMPARISON_ROWS = [
        {
            feature: 'Quality Assurance & Night Auditing',
            xiri: 'Independent Night Manager physical walkthroughs & digital audit logs every shift',
            independent: 'Self-reported cleaning; no secondary audit layer',
            franchise: 'Self-reported franchisee checklists; corporate rarely audits local accounts',
        },
        {
            feature: 'Contractor Vetting & Insurance',
            xiri: '$1M General Liability & Workers Comp verified annually + background checks',
            independent: 'Variable coverage; risk of unverified or lapsed sole-proprietor policies',
            franchise: 'Franchisee buys territory; background checks & insurance depth vary by local operator',
        },
        {
            feature: 'Compliance Documentation',
            xiri: 'Digital logs, SDS binders, OSHA Bloodborne Pathogen & HIPAA audit-ready',
            independent: 'Manual paper logs or informal verbal updates',
            franchise: 'Varies widely; medical compliance add-ons often incur extra fees',
        },
        {
            feature: 'Multi-Trade Scope Management',
            xiri: 'Single contract for Janitorial, HVAC, Floor Care, Day Porters, & Handyman',
            independent: 'Janitorial only; property managers must source separate vendors for trades',
            franchise: 'Janitorial only; separate sub-contracts required for specialized trade work',
        },
        {
            feature: 'Issue Response & SLA Guarantee',
            xiri: 'Sub-2 hour escalation response with dedicated Account Executive',
            independent: 'Direct contact to cleaner (may cause delay during daytime shifts)',
            franchise: 'Escalations routed through corporate regional call centers',
        },
    ];

    const TOWN_FAQS = [
        {
            question: `How do I evaluate commercial cleaning providers in ${townName}?`,
            answer: `When evaluating vendors in ${townName}, verify three core benchmarks: (1) Ask for a current COI showing $1M General Liability and Workers' Compensation. (2) Ask who physically verifies quality — the cleaner or an independent manager? (3) Request digital compliance logs. Xiri Facility Solutions provides managed accountability across all three.`,
        },
        {
            question: `What is the difference between Xiri, independent cleaners, and franchises in ${countyName}?`,
            answer: `Independent cleaners offer direct relationships but often lack compliance infrastructure. National franchises sell accounts to local franchisees, leading to variable quality across ${countyName}. Xiri acts as a single managed partner — recruiting, vetting, and auditing local contractors under a unified SLA.`,
        },
        {
            question: `How quickly can Xiri take over a facility in ${townName}?`,
            answer: `Most facility transitions in ${townName} take 7 to 14 days. We conduct a free initial facility audit, build your customized scope, and transition service with zero disruption to your daily operations.`,
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={{
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: `Evaluating Commercial Cleaning Provider Options in ${townName}, NY`,
                description: `A factual guide to commercial cleaning and janitorial service delivery models in ${townName}, ${countyName}.`,
                datePublished: '2026-01-15',
                dateModified: new Date().toISOString().split('T')[0],
                author: {
                    '@type': 'Organization',
                    name: SITE.name,
                    url: SITE.url,
                },
            }} />

            <AuthorityBreadcrumb
                items={[
                    { label: 'Locations', href: '/locations' },
                    { label: `${townName}, ${state.toUpperCase()}`, href: `/locations/${state}/${county}/${town}` },
                    { label: 'Provider Evaluation' },
                ]}
            />

            <Hero
                title={`Commercial & Medical Cleaning Options in ${townName}, NY`}
                subtitle={`An objective breakdown of commercial janitorial service delivery models in ${townName} and ${countyName} — helping facility directors make an informed vendor decision.`}
                ctaText="Get a Free Facility Audit"
            />

            {/* Comparison Matrix */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">
                            Commercial Cleaning Service Models Compared
                        </h2>
                        <p className="text-slate-600">
                            Facilities in {townName} generally choose between three operational models. Here is how Xiri&apos;s managed approach compares to traditional industry standards.
                        </p>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-sm">
                                    <th className="p-4 sm:p-6 w-1/4">Evaluation Benchmark</th>
                                    <th className="p-4 sm:p-6 w-1/3 bg-sky-900 text-sky-200 border-x border-sky-800">
                                        <div className="font-bold text-base text-white">Xiri Facility Solutions</div>
                                        <div className="text-xs text-sky-300 font-normal">Centralized Managed Model</div>
                                    </th>
                                    <th className="p-4 sm:p-6 w-1/5">Independent Cleaners</th>
                                    <th className="p-4 sm:p-6 w-1/5">National Franchises</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                                {COMPARISON_ROWS.map((row, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="p-4 sm:p-6 font-bold text-slate-900 flex items-start gap-2">
                                            <Building2 className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                                            <span>{row.feature}</span>
                                        </td>
                                        <td className="p-4 sm:p-6 bg-sky-50/40 border-x border-sky-100 font-medium text-slate-900">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                <span>{row.xiri}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-6 text-slate-600">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <span>{row.independent}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-6 text-slate-600">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <span>{row.franchise}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Why Managed Service Matters in Town */}
            <section className="py-16 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <Shield className="w-8 h-8 text-sky-600" />
                            <h3 className="text-lg font-bold text-slate-900">Vetted & Insured Local Crews</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Xiri recruits, vets, and verifies $1M insurance policies for top local contractors servicing {townName}. You get local crew dedication with enterprise corporate safety.
                            </p>
                        </div>

                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <Users className="w-8 h-8 text-sky-600" />
                            <h3 className="text-lg font-bold text-slate-900">Dedicated Night Manager</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Our Night Managers physically inspect shifts in {townName} facilities. We don&apos;t wait for clients to report missed spots — we catch and correct them before your doors open.
                            </p>
                        </div>

                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <Clock className="w-8 h-8 text-sky-600" />
                            <h3 className="text-lg font-bold text-slate-900">2-Hour SLA Response</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Have an unexpected facility issue or upcoming inspection in {townName}? Your dedicated Xiri Account Executive resolves requests within 2 hours guaranteed.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <FAQ items={TOWN_FAQS} />

            {/* CTA Section */}
            <section className="py-16 bg-slate-900 text-white text-center">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold mb-4">
                        Ready to Experience Managed Cleaning in {townName}?
                    </h2>
                    <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
                        Get a complimentary facility walkthrough and customized scope report for your property in {townName}, {state.toUpperCase()}.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text={`Request Audit for ${townName} Facility`}
                        className="inline-block bg-sky-500 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-400 transition-colors shadow-lg"
                    />
                </div>
            </section>
        </div>
    );
}
