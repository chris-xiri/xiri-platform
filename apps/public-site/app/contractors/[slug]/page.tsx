import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { DLPSidebar } from '@/components/DLPSidebar';
import { TRADES, getGeoPages, KEYWORD_PAGES, GUIDE_PAGES } from '@/data/dlp-contractors';
import seoData from '@/data/seo-data.json';
import { MapPin, ArrowRight, Briefcase, Building2 } from 'lucide-react';

type Props = { params: Promise<{ slug: string }> };

const GEO_PAGES = getGeoPages();
const ALL_SLUGS = [
    ...Object.keys(TRADES),
    ...Object.keys(GEO_PAGES),
    ...Object.keys(KEYWORD_PAGES),
    ...Object.keys(GUIDE_PAGES),
];

// Helper: parse trade×location slug like "janitorial-subcontractor-in-great-neck-ny"
function parseTradeLocationSlug(slug: string): { trade: typeof TRADES[string]; tradeSlug: string; location: any } | null {
    const locations = seoData.locations || [];
    for (const loc of locations) {
        const suffix = `-in-${(loc as any).slug}`;
        if (slug.endsWith(suffix)) {
            const tradeSlug = slug.slice(0, slug.length - suffix.length);
            const trade = TRADES[tradeSlug];
            if (trade) return { trade, tradeSlug, location: loc };
        }
    }
    return null;
}

export async function generateStaticParams() {
    const locationSlugs = (seoData.locations || []).map((l: any) => l.slug);
    const tradeSlugs = Object.keys(TRADES);
    const crossProducts = tradeSlugs.flatMap(t => locationSlugs.map((l: string) => ({ slug: `${t}-in-${l}` })));
    return [...ALL_SLUGS.map(slug => ({ slug })), ...crossProducts];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const cross = parseTradeLocationSlug(slug);
    if (cross) {
        const title = `${cross.trade.title} in ${cross.location.name} | XIRI Facility Solutions`;
        const description = `${cross.trade.metaDescription} Now hiring in ${cross.location.name}.`.slice(0, 155);
        return { title, description, alternates: { canonical: `https://xiri.ai/contractors/${slug}` }, openGraph: { title, description, url: `https://xiri.ai/contractors/${slug}`, siteName: 'XIRI Facility Solutions', type: 'website' } };
    }
    const page = TRADES[slug] || GEO_PAGES[slug] || KEYWORD_PAGES[slug] || GUIDE_PAGES[slug];
    if (!page) return {};
    return { title: `${page.title} | XIRI Facility Solutions`, description: page.metaDescription, alternates: { canonical: `https://xiri.ai/contractors/${slug}` }, openGraph: { title: `${page.title} | XIRI`, description: page.metaDescription, url: `https://xiri.ai/contractors/${slug}`, siteName: 'XIRI Facility Solutions', type: 'website' } };
}

export default async function ContractorDLPPage({ params }: Props) {
    const { slug } = await params;

    // ── TRADE PAGES ──
    const trade = TRADES[slug];
    if (trade) {
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: trade.title, description: trade.metaDescription, url: `https://xiri.ai/contractors/${slug}` }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: trade.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
                <Hero title={trade.h1} subtitle={trade.subtitle} ctaText="Apply Now" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-slate-900 mb-8">Why Join the XIRI Network</h2>
                                <div className="grid sm:grid-cols-1 gap-6 mb-10">
                                    {trade.valueProps.map((vp, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Briefcase className="w-5 h-5 text-sky-600" />
                                                <h3 className="text-lg font-bold text-slate-900">{vp.title}</h3>
                                            </div>
                                            <p className="text-slate-600">{vp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category="contractor-trade" currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <FAQ items={trade.faqs} />
                <section className="py-16 bg-slate-900 text-white">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold mb-4">Ready to Join?</h2>
                        <p className="text-xl text-slate-300 mb-8">Apply to become a vetted XIRI subcontractor. We handle the sales — you handle the work.</p>
                        <CTAButton href="/contractors#apply-form" text="Apply Now" className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors" />
                    </div>
                </section>
            </div>
        );
    }

    // ── GEO PAGES ──
    const geo = GEO_PAGES[slug];
    if (geo) {
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: geo.title, description: geo.metaDescription, url: `https://xiri.ai/contractors/${slug}` }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'XIRI Facility Solutions', address: { '@type': 'PostalAddress', addressLocality: geo.title.replace('Cleaning Jobs in ', ''), addressRegion: 'NY' }, geo: { '@type': 'GeoCoordinates', latitude: geo.mapCenter.lat, longitude: geo.mapCenter.lng } }} />
                <Hero title={geo.h1} subtitle={geo.subtitle} ctaText="Apply Now" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                <div className="mb-10 rounded-xl overflow-hidden border border-slate-200">
                                    <iframe title={`Map of ${geo.title}`} width="100%" height="300" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${geo.mapCenter.lat},${geo.mapCenter.lng}&zoom=14`} />
                                </div>
                                <div className="mb-10">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-sky-600" /> Local Insight</h2>
                                    <p className="text-slate-600 text-lg leading-relaxed">{geo.localTexture}</p>
                                </div>
                                <div className="mb-10">
                                    <h3 className="text-xl font-bold text-slate-900 mb-4">Trades We Need Here</h3>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {Object.entries(TRADES).map(([tradeSlug, t]) => (
                                            <Link key={tradeSlug} href={`/contractors/${tradeSlug}`} className="group flex items-center justify-between bg-white rounded-lg p-4 border border-slate-200 hover:border-sky-300 transition-colors">
                                                <span className="font-medium text-slate-800 group-hover:text-sky-700">{t.title.replace(' Opportunities', '')}</span>
                                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category="contractor-geo" currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                {geo.faqs.length > 0 && <FAQ items={geo.faqs} />}
                <section className="py-16 bg-slate-900 text-white">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold mb-4">Work Near Home</h2>
                        <p className="text-xl text-slate-300 mb-8">Facilities in your backyard. Jobs that don&apos;t require a commute.</p>
                        <CTAButton href="/contractors#apply-form" text="Apply Now" className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors" />
                    </div>
                </section>
            </div>
        );
    }

    // ── KEYWORD + GUIDE PAGES ──
    const page = KEYWORD_PAGES[slug] || GUIDE_PAGES[slug];
    if (page) {
        const isGuide = !!GUIDE_PAGES[slug];
        const sidebarCat = isGuide ? 'contractor-guide' : 'contractor-keyword';
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.metaDescription, url: `https://xiri.ai/contractors/${slug}` }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
                <Hero title={page.h1} subtitle={page.subtitle} ctaText="Apply Now" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                {page.sections.map((section, i) => (
                                    <div key={i} className="mb-10">
                                        <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                                        <p className="text-slate-600 text-lg leading-relaxed">{section.content}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category={sidebarCat} currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <FAQ items={page.faqs} />
                <section className="py-16 bg-slate-900 text-white">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold mb-4">Ready to Join the Network?</h2>
                        <p className="text-xl text-slate-300 mb-8">Apply today. We handle the sales — you handle the work.</p>
                        <CTAButton href="/contractors#apply-form" text="Apply Now" className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors" />
                    </div>
                </section>
            </div>
        );
    }

    // ── CROSS-PRODUCT: Trade × Location ──
    const cross = parseTradeLocationSlug(slug);
    if (cross) {
        const { trade: crossTrade, tradeSlug, location } = cross;
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${crossTrade.title} in ${location.name}`, description: crossTrade.metaDescription, url: `https://xiri.ai/contractors/${slug}` }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'XIRI Facility Solutions', address: { '@type': 'PostalAddress', addressLocality: location.name.split(',')[0], addressRegion: location.state }, ...(location.latitude ? { geo: { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude } } : {}) }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: crossTrade.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
                <Hero title={`${crossTrade.h1} in ${location.name.split(',')[0]}`} subtitle={crossTrade.subtitle} ctaText="Apply Now" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                {location.latitude && (
                                    <div className="mb-10 rounded-xl overflow-hidden border border-slate-200">
                                        <iframe title={`Map of ${location.name}`} width="100%" height="300" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${location.latitude},${location.longitude}&zoom=14`} />
                                    </div>
                                )}
                                <div className="mb-10 bg-sky-50 rounded-xl p-6 border border-sky-100">
                                    <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-sky-600" /> {crossTrade.title.replace(' Opportunities', '')} Jobs in {location.name.split(',')[0]}
                                    </h2>
                                    <p className="text-slate-600">
                                        XIRI is actively recruiting {crossTrade.title.replace(' Opportunities', '').toLowerCase()} subcontractors in {location.name} and the surrounding area.
                                        {location.localInsight ? ` ${location.localInsight}` : ''} We handle the sales, billing, and account management — you focus on the work.
                                    </p>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-8">Why Join the XIRI Network</h2>
                                <div className="grid sm:grid-cols-1 gap-6 mb-10">
                                    {crossTrade.valueProps.map((vp, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Briefcase className="w-5 h-5 text-sky-600" />
                                                <h3 className="text-lg font-bold text-slate-900">{vp.title}</h3>
                                            </div>
                                            <p className="text-slate-600">{vp.description}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mb-6">
                                    <Link href={`/contractors/${tradeSlug}`} className="text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                                        ← {crossTrade.title} (All Locations)
                                    </Link>
                                </div>
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category="contractor-trade" currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <FAQ items={crossTrade.faqs} />
                <section className="py-16 bg-slate-900 text-white">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold mb-4">{crossTrade.title.replace(' Opportunities', '')} Work in {location.name.split(',')[0]}</h2>
                        <p className="text-xl text-slate-300 mb-8">Apply to become a vetted XIRI subcontractor. Steady medical facility work near home.</p>
                        <CTAButton href="/contractors#apply-form" text="Apply Now" className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors" />
                    </div>
                </section>
            </div>
        );
    }

    notFound();
}
