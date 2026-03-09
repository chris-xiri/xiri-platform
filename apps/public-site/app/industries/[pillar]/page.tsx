import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { ArrowRight, CheckCircle2, ShieldCheck, DollarSign, Clock, Building2 } from 'lucide-react';
import seoData from '@/data/seo-data.json';
import { INDUSTRY_PILLARS, PILLAR_SLUGS, type IndustryPillar } from '@/lib/industry-pillars';

// ─── STATIC PARAMS ─────────────────────────────────────────────────

export async function generateStaticParams() {
    return PILLAR_SLUGS.map(slug => ({ pillar: slug }));
}

// ─── METADATA ──────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ pillar: string }> }): Promise<Metadata> {
    const { pillar: pillarSlug } = await params;
    const pillar = INDUSTRY_PILLARS.find(p => p.slug === pillarSlug);
    if (!pillar) return {};

    const title = `${pillar.name} Cleaning & Maintenance | XIRI`;
    return {
        title,
        description: pillar.description,
        alternates: { canonical: `https://xiri.ai/industries/${pillar.slug}` },
        openGraph: {
            title,
            description: pillar.description,
            url: `https://xiri.ai/industries/${pillar.slug}`,
            siteName: 'XIRI Facility Solutions',
            type: 'website',
        },
    };
}

// ─── PAGE ──────────────────────────────────────────────────────────

export default async function IndustryPillarPage({ params }: { params: Promise<{ pillar: string }> }) {
    const { pillar: pillarSlug } = await params;
    const pillar = INDUSTRY_PILLARS.find(p => p.slug === pillarSlug);
    if (!pillar) notFound();

    // Resolve industry objects from seo-data
    const industries = pillar.industries
        .map(slug => seoData.industries.find((i: any) => i.slug === slug))
        .filter(Boolean) as any[];

    return (
        <div className="min-h-screen bg-white">
            {/* ═══ STRUCTURED DATA ═══ */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "@id": `https://xiri.ai/industries/${pillar.slug}#service`,
                    "name": `${pillar.name} Cleaning & Maintenance`,
                    "description": pillar.description,
                    "serviceType": `${pillar.name} Facility Services`,
                    "provider": {
                        "@type": "Organization",
                        "@id": "https://xiri.ai/#organization"
                    },
                    "areaServed": {
                        "@type": "State",
                        "name": "New York"
                    },
                    "hasOfferCatalog": {
                        "@type": "OfferCatalog",
                        "name": pillar.name,
                        "itemListElement": industries.map((ind: any, i: number) => ({
                            "@type": "Offer",
                            "position": i + 1,
                            "itemOffered": {
                                "@type": "Service",
                                "name": ind.name,
                                "url": `https://xiri.ai/industries/${pillar.slug}/${ind.slug}`
                            }
                        }))
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://xiri.ai" },
                        { "@type": "ListItem", "position": 2, "name": pillar.name, "item": `https://xiri.ai/industries/${pillar.slug}` },
                    ]
                }}
            />

            {/* Breadcrumb */}
            <AuthorityBreadcrumb
                items={[]}
                pillar={{ href: `/industries/${pillar.slug}`, text: pillar.name }}
            />

            {/* Hero */}
            <Hero
                title={`${pillar.name} Cleaning & Maintenance`}
                subtitle={pillar.description}
                ctaText="Get a Facility Audit"
                ctaLink="/#audit"
            />

            {/* Value Props */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { icon: ShieldCheck, title: '$1M Insured', desc: 'Every contractor carries a $1M liability policy.' },
                            { icon: Clock, title: 'Nightly Audits', desc: 'Our Night Manager physically verifies work every night.' },
                            { icon: DollarSign, title: 'One Invoice', desc: 'Consolidate all maintenance into one monthly bill.' },
                            { icon: CheckCircle2, title: 'Compliance-Ready', desc: 'Audit-ready documentation for every regulatory standard.' },
                        ].map((prop) => (
                            <div key={prop.title} className="text-center">
                                <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <prop.icon className="w-7 h-7 text-sky-600" />
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">{prop.title}</h3>
                                <p className="text-sm text-slate-600">{prop.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Industries Grid */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            {pillar.name} We Serve
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Specialized cleaning and facility management for every type of {pillar.name.toLowerCase().replace(' facilities', '').replace(' & ', ' and ')} facility.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {industries.map((ind: any) => (
                            <Link
                                key={ind.slug}
                                href={`/industries/${pillar.slug}/${ind.slug}`}
                                className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Building2 className="w-6 h-6 text-sky-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-sky-700 transition-colors">
                                    {ind.name}
                                </h3>
                                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                                    {ind.heroSubtitle?.slice(0, 120) || `Professional cleaning and maintenance for ${ind.name.toLowerCase()}.`}…
                                </p>
                                <span className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready for Compliance-Grade Facility Management?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Book a free facility audit. We&apos;ll walk your property, identify compliance gaps, and build a custom scope — all under one insured, audited vendor.
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
