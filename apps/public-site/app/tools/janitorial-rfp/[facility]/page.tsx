import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import RfpBidAnalyzerTool from '@/components/RfpBidAnalyzerTool';
import { FAQ } from '@/components/FAQ';
import { JsonLd } from '@/components/JsonLd';
import { FACILITY_RFP_PRESETS, getFacilityRfpPreset, getAllFacilityRfpPresetSlugs } from '@/lib/rfp-facility-presets';
import { SITE } from '@/lib/constants';
import { ShieldCheck, FileText, CheckCircle2, Award } from 'lucide-react';

type Props = {
    params: Promise<{ facility: string }>;
};

export async function generateStaticParams() {
    return getAllFacilityRfpPresetSlugs().map((facility) => ({ facility }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { facility } = await params;
    const preset = getFacilityRfpPreset(facility);
    if (!preset) return {};

    return {
        title: `${preset.title} | ${SITE.name}`,
        description: preset.metaDescription,
        keywords: [
            `${preset.name.toLowerCase()} janitorial rfp`,
            `${facility} cleaning scope`,
            `${facility} facility management template`,
            `commercial cleaning rfp ${facility}`,
        ],
        alternates: {
            canonical: `https://xiri.ai/tools/janitorial-rfp/${facility}`,
        },
    };
}

export default async function FacilityRfpPage({ params }: Props) {
    const { facility } = await params;
    const preset = getFacilityRfpPreset(facility);

    if (!preset) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Structured Schema Data */}
            <JsonLd data={{
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: preset.title,
                description: preset.metaDescription,
                url: `https://xiri.ai/tools/janitorial-rfp/${facility}`,
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'All',
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                },
            }} />

            <AuthorityBreadcrumb
                items={[
                    { label: 'Tools', href: '/tools' },
                    { label: 'Janitorial RFP Builder', href: '/tools/janitorial-rfp' },
                    { label: preset.name },
                ]}
            />

            {/* Hero Header */}
            <section className="bg-slate-900 text-white py-16">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="inline-flex items-center gap-2 bg-sky-500/20 text-sky-300 border border-sky-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                        <Award className="w-4 h-4" />
                        {preset.badgeText}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">{preset.title}</h1>
                    <p className="text-xl text-slate-300 max-w-3xl leading-relaxed">
                        {preset.heroSubtitle}
                    </p>
                </div>
            </section>

            {/* Interactive Scope & Builder Tool */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        Customize Your {preset.name} Scope Brief
                    </h2>
                    <p className="text-slate-600 text-sm mb-6">
                        Adjust facility parameters below to instantly generate a tailored, professional RFP document for your bidding process.
                    </p>
                    <RfpBidAnalyzerTool initialInput={preset.inputDefaults} />
                </div>

                {/* Educational Content & Compliance Standards */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <ShieldCheck className="w-7 h-7 text-sky-600" />
                            <h3 className="text-xl font-bold text-slate-900">Why a Facility-Specific RFP Standard Matters</h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            {preset.whyRfpMatters}
                        </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-7 h-7 text-sky-600" />
                            <h3 className="text-xl font-bold text-slate-900">Key Compliance Standards Included</h3>
                        </div>
                        <ul className="space-y-3">
                            {preset.keyComplianceStandards.map((std, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-semibold text-slate-900">{std.item}:</span>{' '}
                                        <span className="text-slate-500">{std.standard}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Additional Facility RFP Generators */}
                <section className="bg-sky-50 border border-sky-100 rounded-2xl p-6 sm:p-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Other Facility RFP Standards</h3>
                    <div className="flex flex-wrap gap-3">
                        {getAllFacilityRfpPresetSlugs()
                            .filter((s) => s !== facility)
                            .map((slug) => {
                                const p = FACILITY_RFP_PRESETS[slug];
                                return (
                                    <Link
                                        key={slug}
                                        href={`/tools/janitorial-rfp/${slug}`}
                                        className="bg-white px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:border-sky-300 hover:text-sky-600 transition-colors shadow-xs"
                                    >
                                        {p.name} →
                                    </Link>
                                );
                            })}
                    </div>
                </section>

                {/* FAQ Section */}
                {preset.faqs.length > 0 && <FAQ items={preset.faqs} />}
            </main>
        </div>
    );
}
