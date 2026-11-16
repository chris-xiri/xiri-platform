import { SeoIndustry, SeoService } from "@xiri-facility-solutions/shared";
import { Hero } from "@/components/Hero";
import { ValuePropsSection } from "@/components/ValueProps";
import { ClientLeadForm } from "@/components/ClientLeadForm";
import { FAQ } from "@/components/FAQ";
import { JsonLd } from "@/components/JsonLd";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Wrench, Rocket, ShieldCheck, Moon, DollarSign, MapPin } from "lucide-react";
import seoData from "@/data/seo-data.json";
import { AuthorityBreadcrumb } from "@/components/AuthorityBreadcrumb";
import { NearbyAreas } from "@/components/NearbyAreas";
import { SITE } from '@/lib/constants';
import { IndustryMarketStat } from '@/components/MarketSnapshot';
import { CountyDataBar } from '@/components/CountyDataBar';
import type { CensusEstablishmentResult } from '@/lib/census';
import type { CountySummary, MarketWageContext } from '@/data/open-data';
import { getIndustryHeroSlides } from '@/lib/hero-media';
import { CaseStudySpotlight } from '@/components/CaseStudySpotlight';
import { AskAnyAI } from '@/components/AskAnyAI';
import { getAllLocations, slugify } from '@/lib/location-utils';

interface Location {
    slug: string;
    name: string;
    state: string;
    region: string;
    latitude?: number;
    longitude?: number;
    population?: string;
    medicalDensity?: string;
    keyIntersection?: string;
    localInsight?: string;
    complianceNote?: string;
    serviceChallenges?: string;
    whyXiri?: string;
    facilityTypes?: string[];
    landmarks?: string[];
    nearbyCities?: string[];
    zipCodes?: string[];
    localFaqs?: { question: string; answer: string }[];
}

interface IndustryHubPageProps {
    industry: SeoIndustry;
    pillar?: { href: string; text: string };
    location?: Location;
    /** Census establishment data (from cache, passed by server component) */
    censusResult?: CensusEstablishmentResult;
    /** Plural noun for Census stat, e.g. "physician offices" */
    censusPlural?: string;
    /** County-level demographics + competitor density (from open-data.ts) */
    countySummary?: CountySummary;
    /** Market-vs-regulation wage comparison (from open-data.ts) */
    wageContext?: MarketWageContext;
}

export function IndustryHubPage({ industry, pillar, location, censusResult, censusPlural, countySummary, wageContext }: IndustryHubPageProps) {
    // 1. Resolve Services (IDs to Objects)
    const allServices = (seoData.services || []) as SeoService[];

    const coreServices = industry.coreServices.map(id =>
        allServices.find(s => s.slug === id)
    ).filter(Boolean) as SeoService[];

    const specializedServices = industry.specializedServices?.map(id =>
        allServices.find(s => s.slug === id)
    ).filter(Boolean) as SeoService[] || [];

    // ─── INDUSTRY × LOCATION VIEW ──────────────────────────────────
    if (location) {
        const townName = location.name.split(',')[0].trim();
        const allFaqs = [
            ...(location.localFaqs || []),
            ...(industry.faqs || []),
            { question: `What zip codes do you cover in ${townName}?`, answer: `We serve ${location.zipCodes?.join(', ') || 'the surrounding area'} and all of ${location.region}.` },
        ];

        return (
            <main className="min-h-screen bg-slate-50">
                {/* Structured Data */}
                <JsonLd
                    data={{
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "LocalBusiness",
                                "@id": `${SITE.url}/industries/${pillar?.href?.split('/').pop()}/${industry.slug}-in-${location.slug}#business`,
                                "name": `XIRI ${industry.name} Cleaning — ${location.name}`,
                                "description": location.localInsight || industry.heroSubtitle,
                                "url": `${SITE.url}/industries/${pillar?.href?.split('/').pop()}/${industry.slug}`,
                                "telephone": "+1-516-399-0350",
                                "areaServed": {
                                    "@type": "Place",
                                    "name": location.region,
                                    "address": {
                                        "@type": "PostalAddress",
                                        "addressLocality": townName,
                                        "addressRegion": location.state,
                                        "addressCountry": "US",
                                    },
                                },
                                "geo": {
                                    "@type": "GeoCoordinates",
                                    "latitude": location.latitude,
                                    "longitude": location.longitude,
                                },
                            },
                            {
                                "@type": "FAQPage",
                                "mainEntity": allFaqs.map(faq => ({
                                    "@type": "Question",
                                    "name": faq.question,
                                    "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
                                })),
                            },
                        ],
                    }}
                />
                <JsonLd
                    data={{
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                            ...(pillar ? [{ "@type": "ListItem", "position": 2, "name": pillar.text, "item": `${SITE.url}${pillar.href}` }] : []),
                            { "@type": "ListItem", "position": pillar ? 3 : 2, "name": industry.name, "item": `${SITE.url}${pillar?.href || '/industries'}/${industry.slug}` },
                            { "@type": "ListItem", "position": pillar ? 4 : 3, "name": `${townName}, NY` },
                        ]
                    }}
                />

                <AuthorityBreadcrumb
                    items={[
                        { label: industry.name, href: `${pillar?.href || '/industries'}/${industry.slug}` },
                        { label: `${townName}, NY` },
                    ]}
                    pillar={pillar}
                />

                <Hero
                    title={`${industry.name} Cleaning in ${location.name}`}
                    subtitle={location.localInsight || `${industry.heroSubtitle} Proudly serving facilities near ${location.landmarks?.join(', ') || location.region}.`}
                    ctaText={`Get a Quote for ${townName}`}
                    mediaSlides={getIndustryHeroSlides(industry.slug)}
                />

                {/* Trust Bar */}
                <section className="py-8 bg-slate-900 text-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                            <div>
                                <div className="text-2xl font-bold text-sky-400">{location.medicalDensity?.split(' ')[0] || '10+'}</div>
                                <div className="text-sm text-slate-300 mt-1">Facilities in Area</div>
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
                                <div className="text-2xl font-bold text-sky-400">1</div>
                                <div className="text-sm text-slate-300 mt-1">Invoice Per Month</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* County Data Bar — Demographics + Wage Context */}
                {countySummary && (
                    <CountyDataBar
                        summary={countySummary}
                        wageContext={wageContext ?? null}
                        industryName={industry.name}
                        townName={townName}
                    />
                )}

                {/* Local Insight */}
                <section className="py-16 bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-12 items-start">
                            <div>
                                <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-bold mb-6">
                                    Local Market Intelligence
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                                    Why {industry.name} in {townName} Requires a Specialist
                                </h2>
                                <p className="text-lg text-gray-600 mb-6">
                                    {location.localInsight || `${townName} has unique facility management needs that generic cleaning companies can't address.`}
                                </p>
                                {location.serviceChallenges && (
                                    <p className="text-lg text-gray-600 mb-6">
                                        <strong className="text-gray-900">The Challenge:</strong> {location.serviceChallenges}
                                    </p>
                                )}
                                {location.whyXiri && (
                                    <p className="text-lg text-gray-600">
                                        <strong className="text-gray-900">Our Advantage:</strong> {location.whyXiri}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-4">
                                {location.facilityTypes && location.facilityTypes.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                        <h3 className="font-bold text-slate-900 mb-4">Facility Types We Serve in {townName}</h3>
                                        <ul className="space-y-2">
                                            {location.facilityTypes.map((ft, i) => (
                                                <li key={i} className="flex items-center gap-2 text-slate-700">
                                                    <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                                                    {ft}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {location.keyIntersection && (
                                    <div className="bg-sky-50 rounded-xl p-6 border border-sky-200">
                                        <div className="flex items-center gap-3 mb-2">
                                            <MapPin className="w-5 h-5 text-sky-600" />
                                            <h3 className="font-bold text-slate-900">Service Corridor</h3>
                                        </div>
                                        <p className="text-slate-600">
                                            Our teams operate along <strong>{location.keyIntersection}</strong> and the surrounding {location.region} area nightly.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <ValuePropsSection title={`Our Standard for ${townName}`} />

                <CaseStudySpotlight variant="compact" />

                {/* FAQs */}
                <section className="py-16 bg-slate-50">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">
                            {industry.name} in {townName} — Frequently Asked Questions
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

                {/* Zip Codes */}
                {location.zipCodes && location.zipCodes.length > 0 && (
                    <section className="py-10 bg-slate-900 text-white">
                        <div className="max-w-4xl mx-auto px-4 text-center">
                            <h3 className="font-bold text-lg mb-3">Zip Codes We Serve in {townName}</h3>
                            <div className="flex flex-wrap justify-center gap-3">
                                {location.zipCodes.map((zip, i) => (
                                    <span key={i} className="px-4 py-1.5 bg-slate-800 rounded-full text-sm font-mono text-slate-300 border border-slate-700">
                                        {zip}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Nearby Areas */}
                <NearbyAreas
                    serviceSlug={industry.slug}
                    serviceName={industry.name}
                    nearbyCities={location.nearbyCities || []}
                    currentLocationName={location.name}
                    baseRoute="industries"
                />
            </main>
        );
    }

    // ─── STANDARD INDUSTRY HUB VIEW ────────────────────────────────
    return (
        <main className="min-h-screen bg-slate-50">
            {/* Structured Data */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@graph": [
                        {
                            "@type": "Service",
                            "@id": `${SITE.url}${pillar?.href || '/industries'}/${industry.slug}#service`,
                            "name": industry.heroTitle || `${industry.name} Facility Management`,
                            "description": industry.heroSubtitle,
                            "serviceType": `${industry.name} Cleaning`,
                            "provider": {
                                "@type": "Organization",
                                "@id": `${SITE.url}/#organization`
                            },
                            "areaServed": { "@type": "State", "name": "New York" },
                            ...(pillar && {
                                "isPartOf": {
                                    "@type": "Service",
                                    "@id": `${SITE.url}${pillar.href}#service`
                                }
                            }),
                        },
                        ...(industry.faqs && industry.faqs.length > 0 ? [{
                            "@type": "FAQPage",
                            "mainEntity": industry.faqs.map((faq: any) => ({
                                "@type": "Question",
                                "name": faq.question,
                                "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
                            })),
                        }] : []),
                    ],
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        ...(pillar ? [{ "@type": "ListItem", "position": 2, "name": pillar.text, "item": `${SITE.url}${pillar.href}` }] : []),
                        { "@type": "ListItem", "position": pillar ? 3 : 2, "name": industry.name, "item": `${SITE.url}${pillar?.href || '/industries'}/${industry.slug}` },
                    ]
                }}
            />

            {/* Authority Funnel: Breadcrumb */}
            <AuthorityBreadcrumb
                items={[{ label: industry.name }]}
                pillar={pillar}
            />

            {/* 1. HERO */}
            <Hero
                title={industry.heroTitle || `${industry.name} Facility Management`}
                subtitle={industry.heroSubtitle || "Standardized cleaning and compliance for single-tenant facilities."}
                ctaText="Get a Facility Audit"
                ctaLink="#audit"
                mediaSlides={getIndustryHeroSlides(industry.slug)}
            />

            {/* Census Market Stat */}
            {censusResult && censusResult.establishments > 0 && censusPlural && (
                <section className="py-8 bg-white border-b border-slate-100">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <IndustryMarketStat
                            result={censusResult}
                            plural={censusPlural}
                            audienceFrame="owner"
                        />
                    </div>
                </section>
            )}

            {/* Dental Authority Deep-Dive: For Dentist-Owners, Office Managers & Hygienists */}
            {industry.slug === 'dental-offices' && (
                <section className="py-16 bg-sky-50/70 border-b border-sky-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                        {/* AI / GEO Extractable Summary */}
                        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-sky-200 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">
                                Clinical Standard Summary · CDC DHCP &amp; OSHA 29 CFR 1910.1030
                            </p>
                            <p className="text-slate-800 text-base sm:text-lg leading-relaxed">
                                <strong>XIRI Facility Solutions</strong> provides nightly-verified <strong>dental office janitorial and terminal cleaning</strong> across <strong>Nassau County, Suffolk County, and Queens, NY</strong>. Purpose-built for <strong>dentist-owners (DDS/DMD), dental office managers, and clinical hygiene teams</strong>, our protocol combines chair-safe EPA List N surface disinfection, sterilization lab sanitation, amalgam-safe floor care, Georgia-Pacific restroom supply management, and NFC zone-by-zone proof-of-work under one monthly invoice.
                            </p>
                        </div>

                        {/* Role-Based Value Breakdown */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold mb-3">
                                    For the Dentist / Practice Owner
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">
                                    Protect Your $25k+ Dental Chairs &amp; License
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Generic cleaners ruin A-dec, Belmont, and Pelton &amp; Crane dental chair upholstery with harsh bleach or alcohol. We enforce manufacturer-safe, EPA List N protocols, carry $1M+ liability insurance, and log every shift for state board and OSHA inspections.
                                </p>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <span className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold mb-3">
                                    For the Dental Office Manager
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">
                                    Zero Vendor Chasing. One Consolidated Bill.
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Stop texting no-show cleaners or ordering paper towels and soap from 3 suppliers. Your NFC compliance log arrives automatically before your 7:30 AM morning huddle, and janitorial + supplies + maintenance arrive on a single monthly invoice.
                                </p>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold mb-3">
                                    For Dental Hygienists &amp; Assistants
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">
                                    Treat Patients — Never Scrub Toilets or Floors
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Asking $55–$65/hr Registered Dental Hygienists (RDHs) and dental assistants to mop operatory floors or clean bathrooms drives clinical burnout. Let your clinical team focus on daytime chair turnover while XIRI handles the nightly terminal clean.
                                    </p>
                            </div>
                        </div>

                        {/* Dental Comparison Table + Resource Links */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-bold">Dental Practice Cleaning Models Compared</h3>
                                    <p className="text-xs sm:text-sm text-slate-300 mt-1">Why Long Island &amp; Queens dental offices switch to XIRI</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link href="/guides/dental-office-terminal-cleaning-checklist" className="text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white px-3.5 py-2 rounded-lg transition-colors">
                                        Dental Terminal Cleaning Checklist →
                                    </Link>
                                    <Link href="/tools/janitorial-rfp/dental-offices" className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-lg transition-colors">
                                        Free Dental RFP Builder →
                                    </Link>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                            <th className="p-4 font-bold">Clinical Benchmark</th>
                                            <th className="p-4 font-bold text-sky-700 bg-sky-50/60">XIRI Dental Protocol</th>
                                            <th className="p-4 font-bold">Generic Office Cleaners</th>
                                            <th className="p-4 font-bold">In-House Hygienists / Staff</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="p-4 font-semibold text-slate-900">Operatory &amp; Chair Safety</td>
                                            <td className="p-4 bg-sky-50/40 text-slate-900 font-medium">✓ Chair-safe EPA List N &amp; color-coded microfiber</td>
                                            <td className="p-4 text-slate-500">✗ Bleach/quat overspray cracks vinyl chairs</td>
                                            <td className="p-4 text-slate-500">Rushed wipe-downs between patients</td>
                                        </tr>
                                        <tr>
                                            <td className="p-4 font-semibold text-slate-900">Sterilization &amp; Lab Zones</td>
                                            <td className="p-4 bg-sky-50/40 text-slate-900 font-medium">✓ Clean/dirty zone separation &amp; floor decontamination</td>
                                            <td className="p-4 text-slate-500">✗ Same mop used in restroom and sterilization lab</td>
                                            <td className="p-4 text-slate-500">Takes clinical time away from instrument processing</td>
                                        </tr>
                                        <tr>
                                            <td className="p-4 font-semibold text-slate-900">Proof of Completion</td>
                                            <td className="p-4 bg-sky-50/40 text-slate-900 font-medium">✓ NFC tag scan in every operatory + Night Manager audit</td>
                                            <td className="p-4 text-slate-500">✗ Unverified; discover missed rooms at 7:30 AM</td>
                                            <td className="p-4 text-slate-500">No independent compliance log</td>
                                        </tr>
                                        <tr>
                                            <td className="p-4 font-semibold text-slate-900">True Cost &amp; Staff Morale</td>
                                            <td className="p-4 bg-sky-50/40 text-slate-900 font-medium">✓ Predictable flat monthly bill (includes supplies)</td>
                                            <td className="p-4 text-slate-500">Hidden supply markups &amp; high vendor turnover</td>
                                            <td className="p-4 text-slate-500">✗ $55–$65/hr RDH wage + high staff turnover</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* 2. VALUE PROPS (Generic XIRI Props) */}
            <ValuePropsSection
                title={`Why ${industry.name} Choose XIRI`}
            />

            {/* 3. CORE SERVICES GRID */}
            <CaseStudySpotlight variant="compact" />
            <section className="py-20 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            Complete Facility Management
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Consolidate your vendor list. We manage every aspect of your facility&apos;s maintenance.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {coreServices.map((service) => (
                            <div key={service.slug} className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Wrench className="w-6 h-6 text-sky-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{service.name}</h3>
                                <p className="text-slate-600 mb-6">{service.shortDescription}</p>
                                <ul className="space-y-2 mb-8">
                                    {service.benefits?.slice(0, 3).map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={`/services/${service.slug}`}
                                    className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all"
                                >
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. SPECIALIZED SERVICES (if any) */}
            {specializedServices.length > 0 && (
                <section className="py-20 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-8">Specialized Add-ons</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {specializedServices.map((service) => (
                                <Link
                                    key={service.slug}
                                    href={`/services/${service.slug}`}
                                    className="p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-500 hover:shadow-md transition-all flex items-center gap-3"
                                >
                                    <Wrench className="w-5 h-5 text-sky-600" />
                                    <span className="font-medium text-slate-700">{service.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* LEAD FORM SECTION (Anchor: #audit) */}
            <section id="audit" className="py-24 bg-sky-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <div className="text-white">
                            <div className="inline-block px-4 py-2 rounded-full bg-sky-800 text-sky-200 font-bold text-sm mb-6 border border-sky-700">
                                <Rocket className="w-4 h-4 inline mr-1" /> Start Your Transformation
                            </div>
                            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                                Ready to elevate your facility management?
                            </h2>
                            <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                                Stop worrying about missing shifts, empty supplies, and failed inspections. Let XIRI build a custom scope of work for your facility today.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">100% Insured & Vetted</h4>
                                        <p className="text-sky-200/80">$1M Liability Policy for every single contractor.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        <Moon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Nightly Audits</h4>
                                        <p className="text-sky-200/80">We physically verify the work every night so you don&apos;t have to.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        <DollarSign className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Consolidated Billing</h4>
                                        <p className="text-sky-200/80">One invoice for janitorial, supplies, and maintenance.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Lead Form (Industry Mode) */}
                        <div className="lg:pl-10">
                            <ClientLeadForm
                                industryName={industry.name}
                                prefilledService={industry.coreServices[0]}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. FAQs */}
            {industry.faqs && industry.faqs.length > 0 && (
                <FAQ items={industry.faqs} />
            )}

            {/* 6. Ask Any AI + Tri-County Local Directory Links */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                    <AskAnyAI
                        variant="card"
                        heading={`Ask AI About XIRI's ${industry.name} Protocol`}
                    />

                    <div>
                        <h3 className="text-2xl font-bold font-heading text-slate-900 mb-2 text-center">
                            {industry.name} Cleaning Across Nassau, Suffolk &amp; Queens
                        </h3>
                        <p className="text-slate-600 text-center mb-8 text-sm sm:text-base">
                            Select your town below for local compliance standards, zip code coverage, and instant walkthrough scheduling:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {getAllLocations().map((loc) => {
                                const townName = loc.name.split(',')[0].trim();
                                const stateSlug = slugify(loc.state);
                                const countySlug = slugify(loc.region);
                                const townSlug = slugify(townName);
                                return (
                                    <Link
                                        key={loc.slug}
                                        href={`/locations/${stateSlug}/${countySlug}/${townSlug}/${industry.slug}`}
                                        className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-xs sm:text-sm font-medium text-slate-700 hover:text-sky-700 transition-colors flex items-center gap-2"
                                    >
                                        <MapPin className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                                        <span className="truncate">{townName}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
