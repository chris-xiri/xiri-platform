import Link from 'next/link';
import { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { DLP_SOLUTIONS, SPOKE_HUBS } from '@/data/dlp-solutions';
import { ArrowRight, Shield, Stethoscope, FlaskConical, Factory, Building } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Specialized Solutions Directory | XIRI Facility Solutions',
    description: 'Browse XIRI specialized cleaning and facility management solutions by industry: Healthcare, Life Sciences, Industrial, and Institutional.',
    alternates: { canonical: 'https://xiri.ai/directory/solutions' },
};

const VERTICALS = [
    { key: 'healthcare-labs', icon: Stethoscope, color: 'text-red-500', bg: 'bg-red-50' },
    { key: 'industrial-manufacturing', icon: Factory, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'professional-suites', icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
];

export default function SolutionsDirectory() {
    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Specialized Solutions', description: 'Browse XIRI specialized solutions by industry vertical.', url: 'https://xiri.ai/directory/solutions' }} />
            <Hero title="Specialized Solutions Directory" subtitle="Compliance-grade cleaning protocols organized by industry. Every solution includes nightly audits and documentation." ctaText="Get a Free Site Audit" />

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                    {VERTICALS.map(({ key, icon: Icon, color, bg }) => {
                        const hub = SPOKE_HUBS[key];
                        if (!hub) return null;
                        const dlps = hub.dlpSlugs.map(s => ({ slug: s, ...DLP_SOLUTIONS[s] })).filter(Boolean);

                        return (
                            <div key={key}>
                                <Link href={`/solutions/${key}`} className="group flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
                                        <Icon className={`w-5 h-5 ${color}`} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{hub.title}</h2>
                                        <p className="text-sm text-slate-500">{hub.heroSubtitle.slice(0, 100)}…</p>
                                    </div>
                                </Link>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dlps.map((dlp) => (
                                        <Link key={dlp.slug} href={`/solutions/${dlp.slug}`} className="group block bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
                                            <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors mb-1">{dlp.title}</h3>
                                            <p className="text-xs text-slate-500">{dlp.complianceChecklist.length} compliance items</p>
                                            <div className="mt-2 text-sky-600 text-sm font-medium flex items-center gap-1">View Protocol <ArrowRight className="w-3 h-3" /></div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
