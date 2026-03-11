import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { COMPARISON_PAGES } from '@/data/dlp-comparisons';
import { SITE } from '@/lib/constants';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
    return Object.keys(COMPARISON_PAGES).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const page = COMPARISON_PAGES[slug];
    if (!page) return {};
    return {
        title: `${page.title} | ${SITE.name}`,
        description: page.metaDescription,
        alternates: { canonical: `${SITE.url}/compare/${slug}` },
        openGraph: {
            title: page.title,
            description: page.metaDescription,
            url: `${SITE.url}/compare/${slug}`,
            siteName: SITE.name,
            type: 'article',
        },
    };
}

export default async function ComparisonPage({ params }: Props) {
    const { slug } = await params;
    const page = COMPARISON_PAGES[slug];
    if (!page) notFound();

    const competitorName = page.type === 'vs'
        ? page.title.split(' vs. ')[1]?.split(' —')[0] || 'Competitor'
        : page.type === 'best-of'
            ? 'Industry Average'
            : 'Competitor';

    return (
        <div className="min-h-screen bg-white">
            {/* Article Schema — comparison pages rank high for AI citations */}
            <JsonLd data={{
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: page.h1,
                description: page.metaDescription,
                datePublished: '2026-01-15',
                dateModified: new Date().toISOString().split('T')[0],
                author: {
                    '@type': 'Person',
                    name: 'Chris Leung',
                    jobTitle: 'Founder & CEO',
                    worksFor: { '@type': 'Organization', '@id': `${SITE.url}/#organization` },
                    url: `${SITE.url}/about`,
                },
                publisher: {
                    '@type': 'Organization',
                    '@id': `${SITE.url}/#organization`,
                    name: SITE.name,
                    logo: { '@type': 'ImageObject', url: `${SITE.url}/icon.png` },
                },
                mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/compare/${slug}` },
            }} />
            {/* FAQPage Schema */}
            {page.faqs.length > 0 && (
                <JsonLd data={{
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: page.faqs.map(f => ({
                        '@type': 'Question',
                        name: f.question,
                        acceptedAnswer: { '@type': 'Answer', text: f.answer },
                    })),
                }} />
            )}
            {/* BreadcrumbList */}
            <JsonLd data={{
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
                    { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE.url}/compare` },
                    { '@type': 'ListItem', position: 3, name: page.title, item: `${SITE.url}/compare/${slug}` },
                ],
            }} />

            <AuthorityBreadcrumb items={[{ label: 'Compare', href: '/compare' }, { label: page.title }]} />

            <Hero
                title={page.h1}
                subtitle={page.intro}
                ctaText="Get a Free Facility Audit"
            />

            {/* Comparison Table */}
            <section className="py-16">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                        Side-by-Side Comparison
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200">Feature</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-sky-600 uppercase tracking-wider border-b-2 border-sky-200 bg-sky-50">XIRI</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200">{competitorName}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.comparisonTable.map((row, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100">{row.feature}</td>
                                        <td className="px-6 py-4 text-slate-700 border-b border-slate-100 bg-sky-50/30">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span>{row.xiri}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 border-b border-slate-100">
                                            <div className="flex items-start gap-2">
                                                <XCircle className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                                                <span>{row.competitor}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Content Sections */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {page.sections.map((section, i) => (
                        <div key={i} className="mb-12 last:mb-0">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                            <p className="text-lg text-slate-600 leading-relaxed">{section.content}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Verdict */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <CheckCircle2 className="w-7 h-7 text-sky-600" />
                            The Verdict
                        </h2>
                        <p className="text-lg text-slate-700 leading-relaxed">{page.verdict}</p>
                        <div className="mt-6">
                            <CTAButton
                                href="/#audit"
                                text="Get Your Free Facility Audit →"
                                className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-md"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <FAQ items={page.faqs} />

            {/* Cross-links to other comparisons */}
            <section className="py-12 bg-slate-50 border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">More Comparisons</h3>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(COMPARISON_PAGES)
                            .filter(([s]) => s !== slug)
                            .map(([s, p]) => (
                                <Link
                                    key={s}
                                    href={`/compare/${s}`}
                                    className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 bg-white px-4 py-2 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors"
                                >
                                    {p.title} <ArrowRight className="w-3 h-3" />
                                </Link>
                            ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to See the Difference?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Book a free facility audit. We&apos;ll walk your property, assess your current vendor, and show you what compliance-grade facility management looks like.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Facility Audit"
                        className="inline-block bg-sky-500 text-white px-10 py-4 rounded-xl text-lg font-bold hover:bg-sky-400 transition-colors shadow-lg"
                    />
                </div>
            </section>
        </div>
    );
}
