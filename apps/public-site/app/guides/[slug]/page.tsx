import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import seoData from '@/data/seo-data.json';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { GUIDES, type GuideData } from '@/data/guides';

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    return Object.keys(GUIDES).map(slug => ({ slug }));
}

/**
 * Fetch a published guide from Firestore by slug.
 * Wrapped in React.cache() so generateMetadata and the page share the same result.
 */
const getGuide = cache(async (slug: string): Promise<GuideData | null> => {
    // Check hardcoded guides first (instant, no network)
    if (GUIDES[slug]) return GUIDES[slug];

    // Fall back to Firestore-published guides
    try {
        const q = query(
            collection(db, 'guides'),
            where('slug', '==', slug),
            where('status', '==', 'published')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as GuideData;
    } catch {
        return null;
    }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const guide = await getGuide(slug);
    if (!guide) return {};

    return {
        title: `${guide.title} | XIRI Facility Solutions`,
        description: guide.metaDescription,
        alternates: {
            canonical: `https://xiri.ai/guides/${slug}`,
        },
        openGraph: {
            title: guide.title,
            description: guide.metaDescription,
            url: `https://xiri.ai/guides/${slug}`,
            siteName: 'XIRI Facility Solutions',
            type: 'article',
        },
    };
}

export default async function GuidePage({ params }: Props) {
    const { slug } = await params;
    const guide = await getGuide(slug);

    if (!guide) {
        notFound();
    }

    const relatedServices = seoData.services.filter(s =>
        guide.relatedServices.includes(s.slug)
    );

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: guide.title,
                    description: guide.metaDescription,
                    url: `https://xiri.ai/guides/${slug}`,
                    publisher: {
                        '@type': 'Organization',
                        name: 'XIRI Facility Solutions',
                    },
                }}
            />

            {/* Hero */}
            <Hero
                title={guide.heroTitle}
                subtitle={guide.heroSubtitle}
                ctaText="Get a Free Site Audit"
            />

            {/* ═══ GUIDE CONTENT ═══ */}
            <article className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {guide.sections.map((section, i) => (
                        <div key={i} className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                            <p className="text-lg text-slate-600 mb-4 leading-relaxed">{section.content}</p>
                            {section.items && (
                                <ul className="space-y-3 mt-4">
                                    {section.items.map((item, j) => (
                                        <li key={j} className="flex gap-3 items-start">
                                            <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </article>

            {/* ═══ XIRI CALLOUT ═══ */}
            {guide.calloutTitle && (
                <section className="py-12 bg-sky-50 border-y border-sky-200">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex gap-5 items-start">
                            <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-full flex items-center justify-center text-sky-700">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sky-900 text-lg mb-2">{guide.calloutTitle}</h3>
                                <p className="text-sky-800">{guide.calloutContent}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ FAQs ═══ */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {guide.faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ RELATED SERVICES ═══ */}
            {relatedServices.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Related Services
                        </h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relatedServices.map((s: any) => (
                                <Link key={s.slug} href={`/services/${s.slug}`} className="group block bg-slate-50 hover:bg-sky-50 rounded-xl p-5 border border-slate-200 hover:border-sky-300 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{s.name}</h3>
                                            <p className="text-sm text-slate-500 mt-1">{s.shortDescription?.slice(0, 80)}…</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors flex-shrink-0" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ FINAL CTA ═══ */}
            <section className="py-16 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Want Expert Help?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Book a free site audit. We&apos;ll assess your facility, build a custom cleaning scope, and provide transparent pricing — no obligation.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Site Audit"
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors"
                    />
                </div>
            </section>
        </div>
    );
}
