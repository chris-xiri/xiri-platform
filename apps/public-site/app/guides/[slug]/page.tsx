import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import seoData from '@/data/seo-data.json';
import { CheckCircle, ArrowRight, MapPin, Shield } from 'lucide-react';
import { AuthorityBreadcrumb, PILLAR_HREF, PILLAR_ANCHOR_TEXT } from '@/components/AuthorityBreadcrumb';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    GUIDES,
    REGULATION_GUIDE_SLUGS,
    COUNTY_COMPLIANCE,
    getRegulationLocalFaqs,
    type GuideData,
} from '@/data/guides';
import { LOCATIONS } from '@/lib/locations';
import { SITE } from '@/lib/constants';
import {
    NYC_COMPLIANCE_REQUIREMENTS,
    QUEENS_PSEO_YEARS,
    getQueensCdByNumberAndYear,
    getQueensCdComplianceSlug,
    getQueensCdsByYear,
    getQueensYearComplianceSlug,
} from '@/data/nyc-compliance';

type Props = {
    params: Promise<{ slug: string }>;
};

// ─── SLUG PARSING ──────────────────────────────────────────────────

type GuideParseResult =
    | { type: 'GUIDE'; guideSlug: string }
    | { type: 'REGULATION_LOCATION'; guideSlug: string; location: typeof LOCATIONS[number] }
    | { type: 'QUEENS_YEAR'; year: number }
    | { type: 'QUEENS_CD_YEAR'; cd: number; year: number }
    | { type: 'NOT_FOUND' };

function parseGuideSlug(slug: string): GuideParseResult {
    // 1. Direct guide hub match
    if (GUIDES[slug]) {
        return { type: 'GUIDE', guideSlug: slug };
    }

    // 2. Regulation × Location match (e.g. osha-bloodborne-pathogen-cleaning-standard-in-garden-city-nassau-ny)
    for (const regSlug of REGULATION_GUIDE_SLUGS) {
        if (slug.startsWith(regSlug + '-in-')) {
            const locationPart = slug.substring(regSlug.length + 4); // skip "-in-"
            const matchingLocation = LOCATIONS.find(loc => {
                const countySlug = loc.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return `${loc.slug}-${countySlug}-ny` === locationPart;
            });
            if (matchingLocation) {
                return { type: 'REGULATION_LOCATION', guideSlug: regSlug, location: matchingLocation };
            }
        }
    }

    // 3. Queens annual compliance plan pages
    const yearMatch = slug.match(/^queens-nyc-building-compliance-plan-(\d{4})$/);
    if (yearMatch) {
        const year = Number(yearMatch[1]);
        if (QUEENS_PSEO_YEARS.includes(year as (typeof QUEENS_PSEO_YEARS)[number])) {
            return { type: 'QUEENS_YEAR', year };
        }
    }

    // 4. Queens CD-specific LL152 pages
    const cdMatch = slug.match(/^queens-ll152-gas-piping-cd-(\d{1,2})-(\d{4})$/);
    if (cdMatch) {
        const cd = Number(cdMatch[1]);
        const year = Number(cdMatch[2]);
        const cdProfile = getQueensCdByNumberAndYear(cd, year);
        if (cdProfile) {
            return { type: 'QUEENS_CD_YEAR', cd, year };
        }
    }

    return { type: 'NOT_FOUND' };
}

// ─── STATIC PARAMS ─────────────────────────────────────────────────

export async function generateStaticParams() {
    const params: { slug: string }[] = [];

    // Guide hubs
    for (const slug of Object.keys(GUIDES)) {
        params.push({ slug });
    }

    // Regulation × Location combos
    for (const regSlug of REGULATION_GUIDE_SLUGS) {
        for (const loc of LOCATIONS) {
            const countySlug = loc.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            params.push({ slug: `${regSlug}-in-${loc.slug}-${countySlug}-ny` });
        }
    }

    // Queens annual compliance year hubs + CD pages
    for (const year of QUEENS_PSEO_YEARS) {
        params.push({ slug: getQueensYearComplianceSlug(year) });
        for (const cdProfile of getQueensCdsByYear(year)) {
            params.push({ slug: getQueensCdComplianceSlug(cdProfile.cd, year) });
        }
    }

    return params;
}

// ─── GUIDE DATA FETCHER ────────────────────────────────────────────

const getGuide = cache(async (slug: string): Promise<GuideData | null> => {
    if (GUIDES[slug]) return GUIDES[slug];

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

// ─── METADATA ──────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const parsed = parseGuideSlug(slug);

    if (parsed.type === 'GUIDE') {
        const guide = await getGuide(parsed.guideSlug);
        if (!guide) return {};
        return {
            title: `${guide.title} | XIRI Facility Solutions`,
            description: guide.metaDescription,
            alternates: { canonical: `${SITE.url}/guides/${slug}` },
            openGraph: {
                title: guide.title,
                description: guide.metaDescription,
                url: `${SITE.url}/guides/${slug}`,
                siteName: SITE.name,
                type: 'article',
            },
        };
    }

    if (parsed.type === 'REGULATION_LOCATION') {
        const guide = await getGuide(parsed.guideSlug);
        if (!guide) return {};
        const { location } = parsed;
        const title = `${guide.title} in ${location.city}, ${location.state}`;
        const description = `${guide.metaDescription} Serving ${location.city} and ${location.county} County.`;
        return {
            title: `${title} | XIRI`,
            description: description.slice(0, 155),
            alternates: { canonical: `${SITE.url}/guides/${slug}` },
            openGraph: {
                title,
                description: description.slice(0, 155),
                url: `${SITE.url}/guides/${slug}`,
                siteName: SITE.name,
                type: 'article',
            },
        };
    }

    if (parsed.type === 'QUEENS_YEAR') {
        const title = `Queens NYC Building Compliance Plan ${parsed.year}: Boiler, Backflow, LL152`;
        const description = `Queens ${parsed.year} compliance deadlines for LL152 gas piping, backflow annual testing, boiler filings, and major NYC fine exposure.`;
        return {
            title: `${title} | XIRI`,
            description: description.slice(0, 155),
            alternates: { canonical: `${SITE.url}/guides/${slug}` },
            openGraph: {
                title,
                description: description.slice(0, 155),
                url: `${SITE.url}/guides/${slug}`,
                siteName: SITE.name,
                type: 'article',
            },
        };
    }

    if (parsed.type === 'QUEENS_CD_YEAR') {
        const title = `Queens CD ${parsed.cd} LL152 Gas Piping Deadline ${parsed.year}`;
        const description = `Community District ${parsed.cd} Queens LL152 filing guidance for ${parsed.year}, including penalties, checklist, and annual maintenance planning.`;
        return {
            title: `${title} | XIRI`,
            description: description.slice(0, 155),
            alternates: { canonical: `${SITE.url}/guides/${slug}` },
            openGraph: {
                title,
                description: description.slice(0, 155),
                url: `${SITE.url}/guides/${slug}`,
                siteName: SITE.name,
                type: 'article',
            },
        };
    }

    return {};
}

// ─── PAGE ──────────────────────────────────────────────────────────

export default async function GuidePage({ params }: Props) {
    const { slug } = await params;
    const parsed = parseGuideSlug(slug);

    if (parsed.type === 'NOT_FOUND') {
        notFound();
    }

    // ── CASE A: Guide Hub ──
    if (parsed.type === 'GUIDE') {
        const guide = await getGuide(parsed.guideSlug);
        if (!guide) notFound();
        return <GuideHubView guide={guide!} slug={slug} />;
    }

    // ── CASE B: Regulation × Location ──
    if (parsed.type === 'QUEENS_YEAR') {
        return <QueensComplianceYearView year={parsed.year} slug={slug} />;
    }

    if (parsed.type === 'QUEENS_CD_YEAR') {
        return <QueensComplianceCdView cd={parsed.cd} year={parsed.year} slug={slug} />;
    }

    // ── CASE C: Regulation × Location ──
    const guide = await getGuide(parsed.guideSlug);
    if (!guide) notFound();
    return (
        <RegulationLocationView
            guide={guide!}
            guideSlug={parsed.guideSlug}
            slug={slug}
            location={parsed.location}
        />
    );
}

// ═══════════════════════════════════════════════════════════════════
//  GUIDE HUB VIEW (existing guide pages)
// ═══════════════════════════════════════════════════════════════════

function GuideHubView({ guide, slug }: { guide: GuideData; slug: string }) {
    const relatedServices = seoData.services.filter((s: any) =>
        guide.relatedServices.includes(s.slug)
    );

    const isRegulationGuide = (REGULATION_GUIDE_SLUGS as readonly string[]).includes(slug);

    return (
        <div className="min-h-screen bg-white">
            {/* ═══ STRUCTURED DATA (Article + FAQPage + Dataset) ═══ */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'Article',
                            headline: guide.title,
                            description: guide.metaDescription,
                            url: `${SITE.url}/guides/${slug}`,
                            ...(guide.datePublished && { datePublished: guide.datePublished }),
                            ...(guide.dateModified && { dateModified: guide.dateModified }),
                            author: {
                                '@type': 'Organization',
                                name: SITE.name,
                                url: SITE.url,
                            },
                            publisher: {
                                '@type': 'Organization',
                                name: SITE.name,
                                url: SITE.url,
                                logo: {
                                    '@type': 'ImageObject',
                                    url: 'https://xiri.ai/logo-horizontal-color.svg',
                                },
                            },
                            mainEntityOfPage: {
                                '@type': 'WebPage',
                                '@id': `${SITE.url}/guides/${slug}`,
                            },
                        },
                        {
                            '@type': 'FAQPage',
                            mainEntity: guide.faqs.map(faq => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: faq.answer,
                                },
                            })),
                        },
                        // Dataset schema for regulation guides — marks as "Source of Truth" for AI citability
                        ...(isRegulationGuide ? [{
                            '@type': 'Dataset',
                            name: guide.title,
                            description: guide.metaDescription,
                            url: `${SITE.url}/guides/${slug}`,
                            license: 'https://creativecommons.org/licenses/by/4.0/',
                            creator: {
                                '@type': 'Organization',
                                name: SITE.name,
                                url: SITE.url,
                            },
                            spatialCoverage: {
                                '@type': 'Place',
                                name: 'Nassau County, New York',
                                geo: {
                                    '@type': 'GeoShape',
                                    addressCountry: 'US',
                                    addressRegion: 'NY',
                                },
                            },
                            temporalCoverage: `${guide.datePublished || '2025'}/${new Date().getFullYear()}`,
                            keywords: [
                                guide.title,
                                'commercial cleaning compliance',
                                'Nassau County',
                                'healthcare facility cleaning',
                                'regulatory compliance',
                            ],
                            includedInDataCatalog: {
                                '@type': 'DataCatalog',
                                name: 'XIRI Regulatory Compliance Guides',
                                url: 'https://xiri.ai/guides',
                            },
                            ...(guide.dateModified && { dateModified: guide.dateModified }),
                            ...(guide.datePublished && { datePublished: guide.datePublished }),
                        }] : []),
                    ],
                }}
            />

            {/* ═══ ABOVE-FOLD BREADCRUMB NAV (Authority Funnel) ═══ */}
            <AuthorityBreadcrumb items={[{ label: guide.heroTitle }]} />

            <Hero
                title={guide.heroTitle}
                subtitle={guide.heroSubtitle}
                ctaText="Get a Free Site Audit"
            />

            {/* ═══ GUIDE CONTENT ═══ */}
            <article className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Author byline + last updated — E-E-A-T signals */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">CL</div>
                            <span className="font-medium text-slate-700">Chris Leung</span>
                            <span className="text-slate-400">· Founder & CEO</span>
                        </div>
                        {guide.dateModified && (
                            <>
                                <span className="text-slate-300">|</span>
                                <span className="text-green-600 font-medium">✓ Updated {new Date(guide.dateModified + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                            </>
                        )}
                    </div>
                    {/* Authority Funnel: Hub link within first 200 words */}
                    <p className="text-sm text-slate-600 mb-8 bg-sky-50 border border-sky-200 rounded-lg px-4 py-3">
                        This guide is part of our <Link href={PILLAR_HREF} className="text-sky-700 font-semibold hover:underline">{PILLAR_ANCHOR_TEXT}</Link> resource library — helping facility managers stay compliant across OSHA, HIPAA, CMS, and state regulations.
                    </p>
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

// ═══════════════════════════════════════════════════════════════════
//  REGULATION × LOCATION VIEW (new long-tail pages)
// ═══════════════════════════════════════════════════════════════════

function RegulationLocationView({
    guide,
    guideSlug,
    slug,
    location,
}: {
    guide: GuideData;
    guideSlug: string;
    slug: string;
    location: typeof LOCATIONS[number];
}) {
    const county = COUNTY_COMPLIANCE[location.county];
    const localFaqs = getRegulationLocalFaqs(guideSlug, location.city, location.county);
    const allFaqs = [...localFaqs, ...guide.faqs];

    // Nearby locations for internal linking
    const nearbyLocations = LOCATIONS.filter(
        l => l.county === location.county && l.slug !== location.slug
    ).slice(0, 4);

    // Other regulation guides for cross-linking
    const otherRegulations = REGULATION_GUIDE_SLUGS.filter(s => s !== guideSlug)
        .map(s => ({ slug: s, guide: GUIDES[s] }))
        .filter(r => r.guide)
        .slice(0, 3);

    const relatedServices = seoData.services.filter((s: any) =>
        guide.relatedServices.includes(s.slug)
    );

    const locTitle = `${guide.heroTitle} in ${location.city}, ${location.state}`;

    return (
        <div className="min-h-screen bg-white">
            {/* ═══ STRUCTURED DATA ═══ */}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'Article',
                            headline: guide.title,
                            description: guide.metaDescription,
                            url: `${SITE.url}/guides/${slug}`,
                            ...(guide.datePublished && { datePublished: guide.datePublished }),
                            ...(guide.dateModified && { dateModified: guide.dateModified }),
                            author: {
                                '@type': 'Person',
                                name: 'Chris Leung',
                            },
                            publisher: {
                                '@type': 'Organization',
                                name: SITE.name,
                                url: SITE.url,
                                logo: { '@type': 'ImageObject', url: 'https://xiri.ai/logo-horizontal-color.svg' },
                            },
                            mainEntityOfPage: {
                                '@type': 'WebPage',
                                '@id': `${SITE.url}/guides/${slug}`,
                            },
                        },
                        {
                            '@type': 'LocalBusiness',
                            '@id': `${SITE.url}/guides/${slug}#business`,
                            name: `XIRI Facility Solutions — ${location.city}`,
                            url: `${SITE.url}/guides/${slug}`,
                            telephone: '+1-516-399-0350',
                            areaServed: {
                                '@type': 'Place',
                                name: `${location.city}, ${location.state}`,
                                address: {
                                    '@type': 'PostalAddress',
                                    addressLocality: location.city,
                                    addressRegion: location.state,
                                    addressCountry: 'US',
                                },
                            },
                        },
                        {
                            '@type': 'FAQPage',
                            mainEntity: allFaqs.map(faq => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                            })),
                        },
                    ],
                }}
            />
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
                        { '@type': 'ListItem', position: 2, name: 'Commercial Cleaning Services', item: 'https://xiri.ai/services/commercial-cleaning' },
                        { '@type': 'ListItem', position: 3, name: guide.heroTitle, item: `${SITE.url}/guides/${guideSlug}` },
                        { '@type': 'ListItem', position: 4, name: `${location.city}, ${location.state}`, item: `${SITE.url}/guides/${slug}` },
                    ],
                }}
            />

            {/* ═══ HERO ═══ */}
            {/* ═══ ABOVE-FOLD BREADCRUMB NAV (Authority Funnel: Spoke → Hub → Pillar) ═══ */}
            <AuthorityBreadcrumb items={[
                { label: guide.heroTitle, href: `/guides/${guideSlug}` },
                { label: `${location.city}, ${location.state}` },
            ]} />

            <Hero
                title={locTitle}
                subtitle={`${guide.heroSubtitle} Serving facilities in ${location.city} and throughout ${location.county} County.`}
                ctaText={`Get a Quote for ${location.city}`}
            />

            {/* ═══ TRUST BAR ═══ */}
            <section className="py-8 bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <div>
                            <div className="text-2xl font-bold text-sky-400">{county?.facilityDensity?.split(' ')[0] || '100+'}</div>
                            <div className="text-sm text-slate-300 mt-1">Facilities in {location.county}</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-sky-400">365</div>
                            <div className="text-sm text-slate-300 mt-1">Nights/Year Coverage</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-sky-400">100%</div>
                            <div className="text-sm text-slate-300 mt-1">Fully Insured</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-sky-400">$1M</div>
                            <div className="text-sm text-slate-300 mt-1">Liability Coverage</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ LOCAL COMPLIANCE CONTEXT ═══ */}
            {county && (
                <section className="py-12 bg-amber-50 border-b border-amber-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 items-start">
                        <div className="w-12 h-12 flex-shrink-0 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-amber-900 text-lg mb-2">
                                Compliance Landscape in {location.county} County
                            </h2>
                            <p className="text-amber-800 mb-3">{county.enforcementNote}</p>
                            <p className="text-sm text-amber-700 font-medium">
                                📋 {county.keyFact}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ GUIDE CONTENT (inherited from parent regulation guide) ═══ */}
            <article className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Author byline + last updated — E-E-A-T signals */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">CL</div>
                            <span className="font-medium text-slate-700">Chris Leung</span>
                            <span className="text-slate-400">· Founder & CEO</span>
                        </div>
                        {guide.dateModified && (
                            <>
                                <span className="text-slate-300">|</span>
                                <span className="text-green-600 font-medium">✓ Updated {new Date(guide.dateModified + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                            </>
                        )}
                    </div>
                    {/* Authority Funnel: Hub link within first 200 words (Spoke → Hub → Pillar) */}
                    <p className="text-sm text-slate-600 mb-8 bg-sky-50 border border-sky-200 rounded-lg px-4 py-3">
                        This {location.city} guide is part of our <Link href={PILLAR_HREF} className="text-sky-700 font-semibold hover:underline">{PILLAR_ANCHOR_TEXT}</Link> resource library.
                        <Link href={`/guides/${guideSlug}`} className="text-sky-600 hover:underline ml-2">← View the full {guide.heroTitle} guide</Link>
                    </p>
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

            {/* ═══ LOCAL + REGULATION FAQs COMBINED ═══ */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
                        {guide.heroTitle} in {location.city} — FAQs
                    </h2>
                    <div className="space-y-4">
                        {allFaqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ OTHER REGULATION GUIDES IN THIS LOCATION ═══ */}
            {otherRegulations.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Other Compliance Guides for {location.city}
                        </h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {otherRegulations.map(r => {
                                const countySlug = location.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                const crossSlug = `${r.slug}-in-${location.slug}-${countySlug}-ny`;
                                return (
                                    <Link key={r.slug} href={`/guides/${crossSlug}`} className="group block bg-slate-50 hover:bg-sky-50 rounded-xl p-5 border border-slate-200 hover:border-sky-300 transition-all">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors text-sm">{r.guide!.heroTitle}</h3>
                                                <p className="text-xs text-slate-500 mt-1">in {location.city}, {location.state}</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors flex-shrink-0" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ NEARBY AREAS — same regulation, different town ═══ */}
            {nearbyLocations.length > 0 && (
                <section className="py-12 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
                            <MapPin className="w-5 h-5 inline-block mr-2 text-sky-600" />
                            Also Serving Nearby {location.county} County Areas
                        </h2>
                        <div className="flex flex-wrap justify-center gap-3">
                            {nearbyLocations.map(loc => {
                                const countySlug = loc.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                const nearbySlug = `${guideSlug}-in-${loc.slug}-${countySlug}-ny`;
                                return (
                                    <Link
                                        key={loc.slug}
                                        href={`/guides/${nearbySlug}`}
                                        className="px-4 py-2 bg-white rounded-full border border-slate-200 text-sm text-slate-700 hover:border-sky-300 hover:text-sky-700 transition-colors"
                                    >
                                        {loc.city}, {loc.state}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ RELATED SERVICES ═══ */}
            {relatedServices.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Related Services in {location.city}
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
                        Need Compliant Cleaning in {location.city}?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Book a free site audit. We&apos;ll walk your facility, build a regulation-specific cleaning scope, and match you with vetted contractors in {location.county} County.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Site Audit"
                        location={`${location.city}, ${location.state}`}
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors"
                    />
                </div>
            </section>
        </div>
    );
}

function QueensComplianceYearView({ year, slug }: { year: number; slug: string }) {
    const cdPages = getQueensCdsByYear(year);
    const ll152 = NYC_COMPLIANCE_REQUIREMENTS.find((r) => r.key === 'll152');
    const boiler = NYC_COMPLIANCE_REQUIREMENTS.find((r) => r.key === 'boiler');
    const backflow = NYC_COMPLIANCE_REQUIREMENTS.find((r) => r.key === 'backflow');

    const faqs = [
        {
            question: `What are the highest-risk fines for Queens buildings in ${year}?`,
            answer: `For most Queens portfolios, the largest avoidable fines are LL152 failure-to-file penalties, boiler filing violations, and missed backflow annual test reports. Build your annual plan around these first, then layer in elevator, cooling tower, and FISP obligations where applicable.`,
        },
        {
            question: `Do all Queens buildings need LL152 in ${year}?`,
            answer: `No. LL152 follows a Community District cycle. In ${year}, the Queens districts in-cycle are ${cdPages.map((c) => `CD ${c.cd}`).join(', ')}.`,
        },
        {
            question: `Can one vendor run this annual maintenance calendar?`,
            answer: `Yes. XIRI can coordinate cleaning-led compliance readiness, vendor scheduling, submission reminders, and document control so building managers are not chasing deadlines manually.`,
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'Article',
                            headline: `Queens NYC Building Compliance Plan ${year}`,
                            description: `Annual maintenance and filing checklist for Queens buildings in ${year}.`,
                            url: `${SITE.url}/guides/${slug}`,
                            author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
                            publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
                            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/guides/${slug}` },
                        },
                        {
                            '@type': 'FAQPage',
                            mainEntity: faqs.map((faq) => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                            })),
                        },
                    ],
                }}
            />

            <AuthorityBreadcrumb items={[{ label: `Queens Compliance Plan ${year}` }]} />

            <Hero
                title={`Queens NYC Building Compliance Plan ${year}`}
                subtitle={`Prioritize high-penalty filings first: LL152 gas piping, boiler annual filing, and backflow annual tests. Then layer in elevator, cooling tower, and FISP based on your asset mix.`}
                ctaText="Get Verified Cleaning"
            />

            <section className="py-8 bg-slate-900 text-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sky-300 text-sm font-semibold">{ll152?.title}</p>
                            <p className="text-lg font-bold mt-2">{ll152?.fineSummary}</p>
                        </div>
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sky-300 text-sm font-semibold">{boiler?.title}</p>
                            <p className="text-lg font-bold mt-2">{boiler?.fineSummary}</p>
                        </div>
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sky-300 text-sm font-semibold">{backflow?.title}</p>
                            <p className="text-lg font-bold mt-2">{backflow?.fineSummary}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Queens CD Pages in {year}</h2>
                    <p className="text-slate-600 mb-8">These Community Districts are in-cycle for LL152 filing in {year}.</p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cdPages.map((cdProfile) => (
                            <Link
                                key={cdProfile.cd}
                                href={`/guides/${getQueensCdComplianceSlug(cdProfile.cd, year)}`}
                                className="block rounded-xl border border-slate-200 bg-slate-50 p-5 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                            >
                                <p className="font-bold text-slate-900">Queens CD {cdProfile.cd}</p>
                                <p className="text-sm text-slate-600 mt-2">{cdProfile.neighborhoods.join(', ')}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-slate-50 border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-6">Annual Maintenance Plan for Queens</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Q1: Portfolio Compliance Audit</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Inventory all properties by Community District and equipment type.</li>
                                <li>Mark which buildings require LL152, boiler filings, and backflow tests.</li>
                                <li>Assign owner for each filing packet and due-date tracking.</li>
                            </ul>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Q2: Vendor Scheduling</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Book LMP inspectors and backflow testers before peak season.</li>
                                <li>Schedule boiler and mechanical vendor windows by property priority.</li>
                                <li>Pre-stage access, escorts, and closeout documentation.</li>
                            </ul>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Q3: Filing and Remediation</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Submit all due filings with timestamped proof of submission.</li>
                                <li>Resolve defects quickly to avoid reinspection deadlines.</li>
                                <li>Track open violations weekly until closed.</li>
                            </ul>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Q4: Next-Year Readiness</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Compile annual compliance binder and digital archive.</li>
                                <li>Reforecast next-year cycle work by borough and CD.</li>
                                <li>Lock renewal contracts and budget buffers for penalties risk.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-8">NYC Recurring Compliance Requirements</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {NYC_COMPLIANCE_REQUIREMENTS.map((req) => (
                            <div key={req.key} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                                <h3 className="font-bold text-slate-900">{req.title}</h3>
                                <p className="text-sm text-slate-600 mt-1">{req.cadence} · {req.agency}</p>
                                <p className="text-slate-700 mt-3">{req.fineSummary}</p>
                                <p className="text-sm text-slate-600 mt-2">{req.scope}</p>
                                <a href={req.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm font-semibold text-sky-700 hover:underline">
                                    Official Requirement Source
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Queens Compliance Plan FAQs</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

function QueensComplianceCdView({ cd, year, slug }: { cd: number; year: number; slug: string }) {
    const profile = getQueensCdByNumberAndYear(cd, year);
    if (!profile) {
        notFound();
    }

    const sameYearCds = getQueensCdsByYear(year).filter((entry) => entry.cd !== cd);
    const faqs = [
        {
            question: `What is the LL152 deadline focus for Queens CD ${cd} in ${year}?`,
            answer: `Queens CD ${cd} is in the ${year} filing cycle for Local Law 152. Property teams should complete inspections early and leave buffer time for remediation and filing.`,
        },
        {
            question: `What is the penalty for not filing LL152 for CD ${cd}?`,
            answer: `DOB assesses a $5,000 civil penalty for failure to file LL152 by the required deadline.`,
        },
        {
            question: `How does this connect to annual cleaning and maintenance planning?`,
            answer: `Gas piping compliance works best when coordinated with your broader maintenance calendar, including boiler filing prep and annual backflow testing documentation.`,
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'Article',
                            headline: `Queens CD ${cd} LL152 Gas Piping Deadline ${year}`,
                            description: `Compliance checklist and filing plan for Queens Community District ${cd}.`,
                            url: `${SITE.url}/guides/${slug}`,
                            author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
                            publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
                            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/guides/${slug}` },
                        },
                        {
                            '@type': 'FAQPage',
                            mainEntity: faqs.map((faq) => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                            })),
                        },
                    ],
                }}
            />

            <AuthorityBreadcrumb
                items={[
                    { label: `Queens Compliance Plan ${year}`, href: `/guides/${getQueensYearComplianceSlug(year)}` },
                    { label: `Queens CD ${cd} LL152` },
                ]}
            />

            <Hero
                title={`Queens CD ${cd} LL152 Gas Piping Deadline ${year}`}
                subtitle={`If you manage buildings in ${profile.neighborhoods.join(', ')}, this is your filing-cycle year. Plan inspections early to avoid the $5,000 non-filing penalty.`}
                ctaText="Get Verified Cleaning"
            />

            <section className="py-8 bg-slate-900 text-white border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sm text-sky-300">Cycle Year</p>
                            <p className="font-bold text-lg">{year}</p>
                        </div>
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sm text-sky-300">Community District</p>
                            <p className="font-bold text-lg">Queens CD {cd}</p>
                        </div>
                        <div className="rounded-xl bg-slate-800 p-4 border border-slate-700">
                            <p className="text-sm text-sky-300">Penalty Exposure</p>
                            <p className="font-bold text-lg">$5,000 failure-to-file</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-16 bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-6">CD {cd} Neighborhood Coverage</h2>
                    <div className="flex flex-wrap gap-3">
                        {profile.neighborhoods.map((name) => (
                            <span key={name} className="px-4 py-2 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-sm font-medium">
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 bg-slate-50 border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-6">LL152 Filing Checklist for CD {cd}</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="rounded-xl border border-slate-200 bg-white p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Pre-Inspection</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Confirm building eligibility/exceptions and prior LL152 status.</li>
                                <li>Engage a qualified Licensed Master Plumber early in the year.</li>
                                <li>Prepare access to all gas piping areas and shutoff locations.</li>
                            </ul>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-6">
                            <h3 className="font-bold text-slate-900 mb-3">Filing Control</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li>Track inspection date, findings, and corrective actions.</li>
                                <li>File certification before deadline with submission proof archived.</li>
                                <li>Escalate unresolved defects to avoid lapse into violation status.</li>
                            </ul>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-6">
                        Official source: <a href="https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page" target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">NYC DOB Local Law 152 guidance</a>
                    </p>
                </div>
            </section>

            {sameYearCds.length > 0 && (
                <section className="py-16 bg-white border-b border-slate-200">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Other Queens CDs in the {year} Cycle
                        </h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {sameYearCds.map((entry) => (
                                <Link
                                    key={entry.cd}
                                    href={`/guides/${getQueensCdComplianceSlug(entry.cd, year)}`}
                                    className="block rounded-xl border border-slate-200 bg-slate-50 p-5 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                                >
                                    <p className="font-bold text-slate-900">Queens CD {entry.cd}</p>
                                    <p className="text-sm text-slate-600 mt-2">{entry.neighborhoods.join(', ')}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-16 bg-slate-50">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">CD {cd} FAQs</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
