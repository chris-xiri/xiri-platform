import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import { AuthorityBreadcrumb, PILLAR_CLEANING_HREF, PILLAR_CLEANING_TEXT } from '@/components/AuthorityBreadcrumb';
import { ArrowRight, Stethoscope, Building2, Sparkles, SprayCan, UserCheck, ShieldCheck, CheckCircle2, DollarSign, Clock, Footprints, Rows3, HeartPulse, Scissors, Baby } from 'lucide-react';
import { SITE } from '@/lib/constants';

// ─── SEO METADATA ──────────────────────────────────────────────────

export const metadata: Metadata = {
    title: 'Commercial Cleaning Services Pricing & Quotes (2026)',
    description: 'Compare commercial cleaning services and monthly janitorial pricing for offices, medical facilities, and retail sites. Request a verified local quote.',
    openGraph: {
        title: 'Commercial Cleaning Services Pricing & Quotes (2026)',
        description: 'Compare commercial cleaning services, scope options, and monthly janitorial pricing. Request a verified quote.',
        url: 'https://xiri.ai/services/commercial-cleaning',
    },
    alternates: {
        canonical: 'https://xiri.ai/services/commercial-cleaning',
    },
};

// ─── SUB-SERVICES DATA ─────────────────────────────────────────────

const CLEANING_SERVICES = [
    {
        slug: 'janitorial-services',
        name: 'Janitorial Services',
        description: 'Nightly and recurring janitorial programs for offices, medical suites, and commercial spaces — restroom sanitation, trash, vacuuming, and surface disinfection.',
        icon: Sparkles,
        features: ['Nightly deep cleaning', 'Restroom sanitation', 'Trash & recycling', 'Surface disinfection'],
    },
    {
        slug: 'medical-office-cleaning',
        name: 'Medical Office Cleaning',
        description: 'JCAHO survey-ready cleaning for medical offices, urgent care, surgery centers, and clinical suites — HIPAA-compliant with documented protocols.',
        icon: Stethoscope,
        features: ['JCAHO-compliant protocols', 'HIPAA-safe procedures', 'Terminal cleaning logs', 'Biohazard handling'],
    },
    {
        slug: 'urgent-care-cleaning',
        name: 'Urgent Care Cleaning',
        description: 'Rapid-turnaround cleaning for high-volume urgent care facilities — blood-borne pathogen compliance, waiting room sanitation, and exam room turnover.',
        icon: HeartPulse,
        features: ['BBP-compliant protocols', 'High-traffic sanitation', 'Exam room turnover', 'Waiting area deep clean'],
    },
    {
        slug: 'surgery-center-cleaning',
        name: 'Surgery Center Cleaning',
        description: 'AAAHC and CMS-compliant terminal cleaning for ambulatory surgery centers — OR turnover, sterile corridors, and instrument processing areas.',
        icon: Scissors,
        features: ['OR terminal cleaning', 'AAAHC/CMS compliance', 'Sterile corridor protocols', 'Pre-op & PACU cleaning'],
    },
    {
        slug: 'daycare-cleaning',
        name: 'Daycare & Childcare Cleaning',
        description: 'Child-safe cleaning programs for daycares, preschools, and childcare facilities — non-toxic products, toy sanitation, and DOH-compliant documentation.',
        icon: Baby,
        features: ['Non-toxic products only', 'Toy & surface sanitation', 'DOH documentation', 'Nap area deep clean'],
    },
    {
        slug: 'floor-care',
        name: 'Floor Care',
        description: 'VCT stripping & waxing, tile & grout restoration, hardwood refinishing, and anti-slip treatments for commercial floors.',
        icon: Rows3,
        features: ['Strip & wax (VCT)', 'Tile & grout deep clean', 'Hardwood refinishing', 'Anti-slip treatments'],
    },
    {
        slug: 'carpet-upholstery',
        name: 'Carpet & Upholstery',
        description: 'Hot-water extraction, encapsulation, and bonnet cleaning for commercial carpets, upholstered furniture, and fabric partitions.',
        icon: Footprints,
        features: ['Hot-water extraction', 'Encapsulation cleaning', 'Spot & stain removal', 'Upholstery deep clean'],
    },
    {
        slug: 'day-porter',
        name: 'Day Porters',
        description: 'On-site daytime attendants for lobbies, restrooms, breakrooms, and common areas — keeping your facility spotless during business hours.',
        icon: UserCheck,
        features: ['Lobby & entrance upkeep', 'Restroom restocking', 'Breakroom maintenance', 'Conference room resets'],
    },
    {
        slug: 'disinfecting-services',
        name: 'Disinfecting Services',
        description: 'EPA-registered electrostatic and ULV fogging, high-touch point protocols, and post-exposure decontamination for healthcare and commercial spaces.',
        icon: SprayCan,
        features: ['Electrostatic spraying', 'ULV fogging', 'High-touch protocols', 'Post-exposure decon'],
    },
    {
        slug: 'window-cleaning',
        name: 'Window Cleaning',
        description: 'Interior and exterior window cleaning for commercial buildings, storefronts, and medical facilities — streak-free with safety compliance.',
        icon: Building2,
        features: ['Interior & exterior', 'Streak-free finish', 'Frame & sill cleaning', 'Safety-compliant'],
    },
    {
        slug: 'post-construction-cleanup',
        name: 'Post-Construction Cleanup',
        description: 'Phase I through Phase III cleanup for new builds, renovations, and tenant improvements — dust removal, surface prep, and final polish.',
        icon: Building2,
        features: ['Rough clean (Phase I)', 'Detail clean (Phase II)', 'Final polish (Phase III)', 'Debris removal'],
    },
];

// ─── PAGE ──────────────────────────────────────────────────────────

export default function CommercialCleaningPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Structured Data — Service + StatisticalDistribution */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "@id": "https://xiri.ai/services/commercial-cleaning#service",
                    "name": "Commercial Cleaning Services",
                    "description": "Professional commercial cleaning services for medical, commercial, and specialized facilities. Janitorial, floor care, disinfecting, day porters, and more.",
                    "serviceType": "Commercial Cleaning",
                    "provider": {
                        "@type": "Organization",
                        "@id": `${SITE.url}/#organization`
                    },
                    "areaServed": {
                        "@type": "State",
                        "name": "New York"
                    },
                    "hasOfferCatalog": {
                        "@type": "OfferCatalog",
                        "name": "Commercial Cleaning Services",
                        "itemListElement": CLEANING_SERVICES.map((svc, i) => ({
                            "@type": "Offer",
                            "position": i + 1,
                            "itemOffered": {
                                "@type": "Service",
                                "name": svc.name,
                                "url": `${SITE.url}/services/${svc.slug}`
                            }
                        }))
                    },
                    "offers": {
                        "@type": "AggregateOffer",
                        "priceCurrency": "USD",
                        "lowPrice": "0.07",
                        "highPrice": "0.35",
                        "unitText": "per square foot per visit",
                        "description": "Price range based on facility type, scope, and frequency. Calculated from XIRI's data-backed Commercial Cleaning Calculator.",
                        "url": "https://xiri.ai/calculator",
                        "priceSpecification": {
                            "@type": "UnitPriceSpecification",
                            "priceCurrency": "USD",
                            "unitText": "per square foot per visit",
                            "referenceQuantity": {
                                "@type": "QuantitativeValue",
                                "value": "1",
                                "unitCode": "FTK"
                            }
                        }
                    }
                }}
            />
            {/* LocalBusiness + AreaServed — deep-link 60+ towns */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "LocalBusiness",
                    "@id": "https://xiri.ai/#localbusiness",
                    "name": SITE.name,
                    "url": SITE.url,
                    "telephone": "+1-516-399-0350",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Garden City",
                        "addressRegion": "NY",
                        "postalCode": "11530",
                        "addressCountry": "US"
                    },
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "40.7268",
                        "longitude": "-73.6343"
                    },
                    "areaServed": [
                        { "@type": "County", "name": "Nassau County", "containedInPlace": { "@type": "State", "name": "New York" } },
                        { "@type": "County", "name": "Suffolk County", "containedInPlace": { "@type": "State", "name": "New York" } },
                        { "@type": "Borough", "name": "Queens", "containedInPlace": { "@type": "City", "name": "New York" } },
                        ...["Garden City", "Great Neck", "Manhasset", "Rockville Centre", "Syosset", "Mineola", "Westbury", "New Hyde Park", "Hicksville", "Levittown", "Massapequa", "Plainview", "Jericho", "Old Westbury", "East Meadow", "Merrick", "Bellmore", "Wantagh", "Seaford", "Oceanside", "Lynbrook", "Valley Stream", "Floral Park", "Hempstead", "Freeport", "Long Beach", "Glen Cove", "Port Washington", "Roslyn", "Woodmere", "Cedarhurst", "Hewlett", "Lawrence", "Bethpage", "Farmingdale"].map(city => ({
                            "@type": "City",
                            "name": city,
                            "containedInPlace": { "@type": "County", "name": "Nassau County" }
                        })),
                        ...["Melville", "Huntington", "Stony Brook", "Smithtown", "Bay Shore", "Commack", "Deer Park", "Hauppauge", "Islip", "Babylon"].map(city => ({
                            "@type": "City",
                            "name": city,
                            "containedInPlace": { "@type": "County", "name": "Suffolk County" }
                        })),
                        ...["Astoria", "Long Island City", "Forest Hills", "Bayside", "Flushing", "Jamaica", "Rego Park", "Ridgewood", "Woodside", "Jackson Heights"].map(city => ({
                            "@type": "City",
                            "name": city,
                            "containedInPlace": { "@type": "Borough", "name": "Queens" }
                        })),
                    ],
                    "makesOffer": {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "@id": "https://xiri.ai/services/commercial-cleaning#service"
                        }
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": PILLAR_CLEANING_TEXT, "item": `${SITE.url}${PILLAR_CLEANING_HREF}` },
                    ]
                }}
            />

            {/* Breadcrumb */}
            <AuthorityBreadcrumb
                items={[]}
                pillar={{ href: PILLAR_CLEANING_HREF, text: PILLAR_CLEANING_TEXT }}
            />

            {/* Hero */}
            <Hero
                title="Commercial Cleaning Services"
                subtitle="Clinical-grade janitorial, floor care, disinfecting, and specialty cleaning — fully insured, nightly audited, and consolidated into one invoice."
                ctaText="Get a Building Scope"
                ctaLink="/#audit"
            />

            {/* Pricing intent handoff */}
            <section className="py-8 bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-slate-600">
                        Looking for pricing first?
                        {' '}
                        <Link href="/calculator" className="font-semibold text-sky-700 hover:underline">
                            Use the janitorial cost calculator
                        </Link>
                        {' '}
                        for instant monthly estimates, then return here for service scope details.
                    </p>
                </div>
            </section>

            {/* Value Props */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { icon: ShieldCheck, title: '$1M Insured', desc: 'Every team carries a $1M liability policy and is fully insured.' },
                            { icon: Clock, title: 'Nightly Audits', desc: 'Our Night Manager physically verifies cleaning quality every night.' },
                            { icon: DollarSign, title: 'One Invoice', desc: 'Consolidate all cleaning services into one monthly bill.' },
                            { icon: CheckCircle2, title: 'JCAHO Ready', desc: 'Clinical-grade protocols that keep your facility survey-ready 24/7.' },
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

            {/* Services Grid */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            Every Cleaning Service Under One Roof
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            From nightly janitorial to post-construction cleanup, XIRI handles every aspect of your facility&apos;s cleanliness so you never worry about a surprise inspection.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {CLEANING_SERVICES.map((service) => (
                            <Link
                                key={service.slug}
                                href={`/services/${service.slug}`}
                                className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <service.icon className="w-6 h-6 text-sky-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-sky-700 transition-colors">
                                    {service.name}
                                </h3>
                                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                                    {service.description}
                                </p>
                                <ul className="space-y-2 mb-6">
                                    {service.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <span className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cross-link to Facility Management */}
            <section className="py-16 bg-sky-50 border-y border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        Need Building Maintenance Too?
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Most of our cleaning clients also use our{' '}
                        <Link href="/services/facility-management" className="text-sky-700 font-medium hover:underline">
                            Facility and Building Management Services
                        </Link>
                        . Bundle HVAC, pest control, handyman, and more under one invoice for maximum savings.
                    </p>
                    <Link
                        href="/services/facility-management"
                        className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                    >
                        Explore Facility Management →
                    </Link>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready for Clinical-Grade Clean?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Book a free building scope. We&apos;ll walk your facility, document every surface and area, and build a custom cleaning program — all under one insured, audited vendor.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Building Scope"
                        className="inline-block bg-sky-500 text-white px-10 py-4 rounded-xl text-lg font-bold hover:bg-sky-400 transition-colors shadow-lg"
                    />
                </div>
            </section>
        </div>
    );
}
