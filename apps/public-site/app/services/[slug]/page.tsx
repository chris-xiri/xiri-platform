import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { ValuePropsSection } from '@/components/ValueProps';
import { ServiceTracker } from '@/components/ServiceTracker';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { NearbyAreas } from '@/components/NearbyAreas';
import seoData from '@/data/seo-data.json';
import { PARTNER_MARKETS } from '@/data/partnerMarkets';
import { SeoService } from '@xiri/shared';
// FIX: Add Lucide imports
import { MapPin, Eye } from 'lucide-react';

interface Location {
    slug: string;
    name: string;
    state: string;
    region: string;
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

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

// Generate all Service + Industry + Location combinations
export async function generateStaticParams() {
    const params = [];
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 1. Service Hubs (e.g. /services/medical-office-cleaning)
    for (const service of seoData.services) {
        params.push({ slug: service.slug });
    }

    // 2. Industry Hubs (e.g. /services/auto-dealerships)
    for (const industry of seoData.industries) {
        params.push({ slug: industry.slug });
    }

    // 3. Service x Location combos (e.g. /services/medical-office-cleaning-in-garden-city-nassau-ny)
    for (const service of seoData.services) {
        for (const location of seoData.locations) {
            const countySlug = slugify(location.region);
            const townSlug = slugify(location.name.split(',')[0]);
            const stateSlug = "ny";
            params.push({ slug: `${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}` });
        }
    }

    // 4. Industry x Location combos (e.g. /services/auto-dealerships-in-new-hyde-park-nassau-ny)
    for (const industry of seoData.industries) {
        for (const location of seoData.locations) {
            const countySlug = slugify(location.region);
            const townSlug = slugify(location.name.split(',')[0]);
            const stateSlug = "ny";
            params.push({ slug: `${industry.slug}-in-${townSlug}-${countySlug}-${stateSlug}` });
        }
    }

    return params;
}

// ─── Industry & Service Compliance Pitch Map ───
// Maps both industry pages (/services/auto-dealerships) and service pages (/services/janitorial-services)
const MEDICAL_LOGIC: Record<string, { titlePrefix: string; compliance: string; pitch: string }> = {
    // ── INDUSTRY PAGES (tenant building types) ──
    // Medical
    'medical-offices': { titlePrefix: '100% OSHA-Compliant', compliance: 'OSHA + HIPAA', pitch: 'JCAHO-grade disinfection, nightly audits & full infection control' },
    'urgent-care': { titlePrefix: 'OSHA + HIPAA Compliant', compliance: 'OSHA + HIPAA', pitch: 'rapid-turnover sterile protocols for high-volume patient care' },
    'surgery-centers': { titlePrefix: 'AAAHC Audit-Ready', compliance: 'CMS + AAAHC', pitch: 'terminal cleaning with AORN-standard OR protocols' },
    'dental-offices': { titlePrefix: 'OSHA-Compliant', compliance: 'OSHA + HIPAA', pitch: 'sterilization-grade cleaning for operatories & waiting areas' },
    'dialysis-centers': { titlePrefix: 'CMS Audit-Ready', compliance: 'CMS + OSHA', pitch: 'bloodborne pathogen protocols & dialysis-specific sanitation' },
    // Automotive
    'auto-dealerships': { titlePrefix: 'CSI Score-Boosting', compliance: 'OSHA + EPA', pitch: 'showroom-ready cleaning + OSHA chemical safety (SDS) for service bays' },
    // Childcare & Education
    'daycare-preschool': { titlePrefix: 'Child-Safe & Licensed', compliance: 'CDC + Green Seal', pitch: 'non-toxic Green Seal cleaning to reduce illness & keep parents confident' },
    'private-schools': { titlePrefix: 'Child-Safe & Compliant', compliance: 'CDC + Green Seal', pitch: 'non-toxic cleaning meeting school health & safety licensing requirements' },
    // Veterinary
    'veterinary-clinics': { titlePrefix: 'Cross-Contamination Safe', compliance: 'OSHA + EPA', pitch: 'clinical-grade sanitation preventing cross-contamination in surgical & recovery areas' },
    'converted-clinical-suites': { titlePrefix: 'Compliance-Ready', compliance: 'OSHA + JCAHO', pitch: 'specialized protocols for residential-to-medical conversions — HVAC, flooring & shared-entrance infection control' },
    // Labs & Cleanrooms
    'labs-cleanrooms': { titlePrefix: 'ISO 14644-1 Certified', compliance: 'ISO 14644-1 + cGMP', pitch: 'ISO-classified cleanroom maintenance with cGMP documentation & CHP-trained crews' },
    // Light Manufacturing
    'light-manufacturing': { titlePrefix: 'FOD-Prevention Grade', compliance: 'cGMP + OSHA', pitch: 'FOD prevention, ESD-safe floor care & chain-of-custody documentation for production facilities' },
    // Other commercial
    'fitness-gyms': { titlePrefix: 'Health Code-Compliant', compliance: 'Health Dept + ADA', pitch: 'high-touch surface sanitization & locker room health code compliance' },
    'professional-offices': { titlePrefix: 'Nightly-Verified', compliance: 'OSHA', pitch: 'nightly-verified cleaning with documented shift logs & $1M insurance' },
    'retail-storefronts': { titlePrefix: 'Customer-Ready', compliance: 'OSHA + ADA', pitch: 'ADA-compliant, nightly-verified cleaning for high-traffic retail' },

    // ── SERVICE PAGES (cross-industry services) ──
    'medical-office-cleaning': { titlePrefix: '100% OSHA-Compliant', compliance: 'OSHA + HIPAA', pitch: 'JCAHO-grade disinfection protocols, nightly verified' },
    'urgent-care-cleaning': { titlePrefix: 'OSHA + HIPAA Compliant', compliance: 'OSHA + HIPAA', pitch: 'rapid-turnover sterile protocols for high-volume patient care' },
    'surgery-center-cleaning': { titlePrefix: 'AAAHC Audit-Ready', compliance: 'CMS + AAAHC', pitch: 'terminal cleaning with AORN-standard OR protocols' },
    'daycare-cleaning': { titlePrefix: 'Child-Safe & Licensed', compliance: 'CDC + Green Seal', pitch: 'non-toxic Green Seal cleaning to reduce seasonal illness & keep parents confident' },
    'commercial-cleaning': { titlePrefix: 'Nightly-Verified', compliance: 'OSHA', pitch: 'nightly-verified cleaning with $1M-insured contractors' },
    'janitorial-services': { titlePrefix: 'Nightly-Verified', compliance: 'OSHA', pitch: '365 nights/yr audited janitorial with $1M-insured contractors' },
    'floor-care': { titlePrefix: 'Slip/Fall Prevention', compliance: 'OSHA', pitch: 'OSHA-compliant slip/fall prevention & high-gloss floor care' },
    'disinfecting-services': { titlePrefix: 'EPA-Registered', compliance: 'CDC + EPA', pitch: 'EPA-registered disinfection with documented kill-rate protocols' },
    'carpet-upholstery': { titlePrefix: 'Deep-Cleaned & Verified', compliance: 'EPA', pitch: 'deep extraction cleaning with EPA-compliant products' },
    'window-cleaning': { titlePrefix: 'Fully Insured', compliance: 'OSHA', pitch: '$1M-insured, scheduled & inspected window care' },
    'pressure-washing': { titlePrefix: 'EPA-Compliant', compliance: 'OSHA + EPA', pitch: 'EPA-compliant runoff management with OSHA safety protocols' },
    'day-porter': { titlePrefix: 'Shift-Documented', compliance: 'OSHA', pitch: 'real-time facility monitoring with documented shift logs' },
    'snow-ice-removal': { titlePrefix: 'Liability-Protected', compliance: 'OSHA', pitch: 'OSHA-compliant slip/fall prevention — every event documented & audited' },
    'hvac-maintenance': { titlePrefix: 'EPA-Compliant', compliance: 'EPA + OSHA', pitch: 'EPA-compliant air quality maintenance for occupied facilities' },
    'pest-control': { titlePrefix: 'Health Code-Compliant', compliance: 'EPA + Health Dept', pitch: 'integrated pest management meeting local health code standards' },
    'waste-management': { titlePrefix: 'Fully Compliant', compliance: 'OSHA + EPA', pitch: 'documented chain-of-custody waste handling with EPA compliance' },
    'parking-lot-maintenance': { titlePrefix: 'ADA-Compliant', compliance: 'ADA + OSHA', pitch: 'ADA accessibility maintenance + slip/fall prevention' },
    'handyman-services': { titlePrefix: 'Fully Insured', compliance: 'OSHA', pitch: '$1M-insured, background-checked maintenance crews' },
};

// Fallback for any service not in the map
const DEFAULT_LOGIC = { titlePrefix: '100% OSHA-Compliant', compliance: 'OSHA', pitch: 'nightly-verified, $1M-insured contractors' };

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'SERVICE') {
        const service = data as any;
        const logic = MEDICAL_LOGIC[service.slug] || DEFAULT_LOGIC;
        // Title: compliance prefix + "Cleaning for" + service name + brand
        const title = `${logic.titlePrefix} Cleaning for ${service.heroTitle || service.name} | XIRI Facility Solutions`;
        // Description: surgical pitch + numbers + CTA
        const description = `${service.shortDescription} ${logic.pitch}. 1 partner, 1 invoice, 365 nights/yr verified. Free walkthrough →`.slice(0, 155);
        return {
            title,
            description,
            alternates: {
                canonical: `https://xiri.ai/services/${service.slug}`
            },
            openGraph: {
                title,
                description,
                url: `https://xiri.ai/services/${service.slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    } else if (type === 'LOCATION') {
        const { service, location } = data as { service: any; location: Location };
        const logic = MEDICAL_LOGIC[service.slug] || DEFAULT_LOGIC;
        // Title: compliance prefix + "Cleaning for" + service + location + brand
        const title = `${logic.titlePrefix} Cleaning for ${service.name} in ${location.name} | XIRI`;
        // Description: local hook + surgical pitch + numbers + CTA
        const localHook = location.localInsight
            ? `${location.localInsight} `
            : '';
        const description = `${localHook}${service.name} in ${location.name} — ${logic.pitch}. $1M-insured, 1 invoice. ${logic.compliance} audit-ready. Free walkthrough →`.slice(0, 155);

        return {
            title,
            description,
            alternates: {
                canonical: `https://xiri.ai/services/${slug}`
            },
            openGraph: {
                title,
                description,
                url: `https://xiri.ai/services/${slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    }

    return {};
}

export default async function ServicePage({ params }: Props) {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'NOT_FOUND') {
        notFound();
    }

    // --- CASE A: Service Hub ---
    if (type === 'SERVICE') {
        // Reuse the logic from the old service detail page
        // But for cleaner code, we can just render the logic here or import a component.
        // Since we don't have a separate exported component verified, implementing inline for safety.
        const service = data as SeoService;
        return (
            <div className="min-h-screen bg-white">
                <ServiceTracker service={service.slug} location="hub" />
                <JsonLd
                    data={{
                        "@context": "https://schema.org",
                        "@type": "Service",
                        "name": service.name,
                        "description": service.shortDescription,
                        "serviceType": "Facility Management",
                        "areaServed": "New York"
                    }}
                />
                <Hero
                    title={service.heroTitle || service.name}
                    subtitle={service.heroSubtitle || service.shortDescription}
                    ctaText="Get a Quote"
                />
                <ValuePropsSection
                    title={`Why Choose XIRI for ${service.name}`}
                />
                {/* Features */}
                <section className="py-16 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                            Comprehensive {service.name}
                        </h2>
                        {(service as any).longDescription && (
                            <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto mb-12">
                                {(service as any).longDescription}
                            </p>
                        )}
                        {!((service as any).longDescription) && (
                            <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto mb-12">
                                {service.shortDescription}
                            </p>
                        )}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {service.features?.map((feature, i) => (
                                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="text-3xl mb-4 text-sky-600">
                                        {/* Simple icon mapping */}
                                        {feature.icon === 'sparkles' ? '✨' : feature.icon === 'shield' ? '🛡️' : '📋'}
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 text-sm">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                {/* FAQs */}
                <FAQ items={service.faqs || []} />

                {/* ═══ OTHER SERVICES (cross-link) ═══ */}
                {(() => {
                    const otherServices = seoData.services.filter(s => s.slug !== service.slug).slice(0, 6);
                    if (otherServices.length === 0) return null;
                    return (
                        <section className="py-16 bg-white border-t border-gray-200">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                                    Explore Our Other Services
                                </h2>
                                <p className="text-gray-500 text-center mb-10 max-w-2xl mx-auto">
                                    From daily janitorial to specialized floor care, XIRI manages every aspect of your facility under one roof.
                                </p>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {otherServices.map((s: any) => (
                                        <Link key={s.slug} href={`/services/${s.slug}`} className="block bg-gray-50 hover:bg-sky-50 rounded-xl p-5 border border-gray-200 hover:border-sky-300 transition-colors group">
                                            <h3 className="font-bold text-gray-900 group-hover:text-sky-700 transition-colors">{s.name}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{s.shortDescription?.slice(0, 100)}…</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </section>
                    );
                })()}

                {/* ═══ FINAL CTA ═══ */}
                <section className="py-16 bg-gray-50 border-t border-gray-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">
                            Ready to Get Started?
                        </h2>
                        <p className="text-xl text-gray-600 mb-8">
                            Book a free site audit. We'll walk your facility, build a custom scope, and match you with vetted contractors — all under one invoice.
                        </p>
                        <CTAButton
                            href="/#audit"
                            text="Get Your Free Site Audit"
                            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                        />
                    </div>
                </section>
            </div>
        );
    }

    // --- CASE B: Service Location Page ---
    const { service, location } = data as { service: SeoService, location: Location };

    const townName = location.name.split(',')[0].trim();

    // Inject Landmarks into Hero
    const heroTitle = `${service.name} in ${location.name}`;
    const heroSubtitle = location.localInsight
        || `${service.shortDescription} Proudly serving medical facilities near ${location.landmarks?.join(', ') || location.region}.`;

    // Combine service + location FAQs for FAQPage schema
    const allFaqs = [
        ...(location.localFaqs || []),
        ...(service.faqs || []),
        { question: `What zip codes do you cover in ${townName}?`, answer: `We serve ${location.zipCodes?.join(', ') || 'the surrounding area'} and all of ${location.region}.` },
    ];

    // Enhanced JSON-LD: LocalBusiness + FAQPage
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: `XIRI ${service.name} — ${location.name}`,
            description: location.localInsight || service.shortDescription,
            areaServed: {
                '@type': 'Place',
                name: location.region,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: townName,
                    addressRegion: location.state,
                    postalCode: location.zipCodes?.[0],
                }
            },
            url: `https://xiri.ai/services/${slug}`,
            telephone: '+1-516-000-0000',
            priceRange: '$$',
            department: {
                '@type': 'ProfessionalService',
                name: service.name,
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: allFaqs.map(faq => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: faq.answer,
                },
            })),
        },
    ];

    // Other services available in this location (for cross-linking)
    const otherServices = seoData.services.filter(s => s.slug !== service.slug).slice(0, 4);
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return (
        <div className="min-h-screen bg-white">
            {/* Structured Data */}
            {jsonLd.map((ld, i) => (
                <JsonLd key={i} data={ld} />
            ))}
            <ServiceTracker service={service.slug} location={location.slug} />

            {/* Dynamic Hero */}
            <Hero
                title={heroTitle}
                subtitle={heroSubtitle}
                ctaText={`Get a Quote for ${townName}`}
            />

            {/* ═══ TRUST BAR ═══ */}
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
                            <div className="text-sm text-slate-300 mt-1">Insured & Bonded</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-sky-400">1</div>
                            <div className="text-sm text-slate-300 mt-1">Invoice Per Month</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ LOCAL INSIGHT — unique per town ═══ */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div>
                            <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-bold mb-6">
                                Local Market Intelligence
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-6">
                                Why {service.name} in {townName} Requires a Specialist
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
                            {/* Facility types we serve */}
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
                            {/* Key corridor info */}
                            {location.keyIntersection && (
                                <div className="bg-sky-50 rounded-xl p-6 border border-sky-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <MapPin className="w-5 h-5 text-sky-600" />
                                        <h3 className="font-bold text-slate-900">Service Corridor</h3>
                                    </div>
                                    <p className="text-slate-600">
                                        Our teams operate along <strong>{location.keyIntersection}</strong> and
                                        the surrounding {location.region} area nightly.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ HOW IT WORKS — 3 steps ═══ */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                        How {service.name} Works with XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Free Site Audit', desc: `We walk your ${townName} facility, document the scope, and build a custom cleaning plan — no cookie-cutter packages.` },
                            { step: '02', title: 'Vetted Contractors', desc: `We match you with insured, background-checked contractors already operating in ${location.region}. You approve before work begins.` },
                            { step: '03', title: 'Nightly Verification', desc: `Our Night Managers physically audit every clean at your facility. You get one monthly invoice and zero headaches.` },
                        ].map((item, i) => (
                            <div key={i} className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 relative">
                                <div className="text-5xl font-bold text-sky-100 absolute top-4 right-6">{item.step}</div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 relative">{item.title}</h3>
                                <p className="text-slate-600 relative">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ COMPLIANCE CALLOUT ═══ */}
            {location.complianceNote && (
                <section className="py-12 bg-amber-50 border-y border-amber-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 items-start">
                        <div className="w-12 h-12 flex-shrink-0 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-amber-900 text-lg mb-2">Compliance & Regulation in {location.region}</h3>
                            <p className="text-amber-800">{location.complianceNote}</p>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ LOCAL MARKET PULSE (from partner data) ═══ */}
            {(() => {
                const market = PARTNER_MARKETS.find(m =>
                    m.geography.town.toLowerCase() === townName.toLowerCase()
                );

                if (!market || !market.localContext) return null;

                return (
                    <section className="py-20 bg-white border-b border-slate-200">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="grid md:grid-cols-2 gap-12 items-center">
                                <div className="order-2 md:order-1 relative h-96 rounded-2xl overflow-hidden shadow-xl bg-white border border-slate-100">
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <MapPin className="w-8 h-8" />
                                            </div>
                                            <p className="font-bold text-slate-400">Active Service Area</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-8 left-8 bg-white p-3 rounded-lg shadow-lg border border-slate-100 max-w-[200px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-bold text-slate-700">Live Coverage</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{location.name}</p>
                                    </div>
                                </div>

                                <div className="order-1 md:order-2">
                                    <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-bold mb-6">
                                        Local Operations
                                    </div>
                                    <h2 className="text-3xl font-bold font-heading text-slate-900 mb-6">
                                        Already Operating in {townName}
                                    </h2>
                                    <div className="space-y-6 text-lg text-slate-600">
                                        {market.localContext.corridor && (
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                                    <MapPin className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 mb-1">Active Routes</h3>
                                                    <p>Our teams are active along <strong className="text-slate-900">{market.localContext.corridor}</strong>.</p>
                                                </div>
                                            </div>
                                        )}
                                        {market.localContext.painPoints && market.localContext.painPoints.length > 0 && (
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                                    <Eye className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 mb-1">Problem Solvers</h3>
                                                    <p>Specialized in solving <strong className="text-slate-900">{market.localContext.painPoints[0]}</strong>.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            })()}

            <ValuePropsSection title={`Our Standard for ${townName}`} />

            {/* ═══ COMBINED FAQs (location-specific + service) ═══ */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">
                        {service.name} in {townName} — Frequently Asked Questions
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

            {/* ═══ CROSS-SERVICE LINKS — same location, different services ═══ */}
            {otherServices.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Other Services Available in {townName}
                        </h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {otherServices.map((s: any) => {
                                const countySlug = slugify(location.region);
                                const townSlug = slugify(townName);
                                const crossSlug = `${s.slug}-in-${townSlug}-${countySlug}-${location.state.toLowerCase()}`;
                                return (
                                    <Link key={s.slug} href={`/services/${crossSlug}`} className="block bg-slate-50 hover:bg-sky-50 rounded-xl p-5 border border-slate-200 hover:border-sky-300 transition-colors group">
                                        <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{s.name}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{s.shortDescription?.slice(0, 80)}…</p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ ZIP CODE COVERAGE ═══ */}
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
                        <p className="text-sm text-slate-400 mt-4">Plus all surrounding areas in {location.region}</p>
                    </div>
                </section>
            )}

            {/* ═══ FINAL CTA ═══ */}
            <section className="py-16 bg-gray-50 border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Ready for {service.name} in {townName}?
                    </h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Book a free site audit. We'll walk your facility, build a custom scope, and have you covered within a week.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Site Audit"
                        location={location.name}
                        className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    />
                </div>
            </section>

            <NearbyAreas
                serviceSlug={service.slug}
                serviceName={service.name}
                nearbyCities={location.nearbyCities || []}
                currentLocationName={location.name}
            />
        </div>
    );
}

// Logic to determine what the slug is
function parseSlug(slug: string) {
    // 1. Check if it's a Service Hub
    const service = seoData.services.find(s => s.slug === slug);
    if (service) {
        return { type: 'SERVICE', data: service };
    }

    // 2. Check if it's an Industry Hub (e.g. /services/auto-dealerships)
    const industry = seoData.industries.find((i: any) => i.slug === slug);
    if (industry) {
        return { type: 'SERVICE', data: industry };
    }

    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 3. Check if it's a Service x Location page
    const matchingService = seoData.services.find(s => slug.startsWith(s.slug + '-in-'));
    if (matchingService) {
        const locationPart = slug.substring(matchingService.slug.length + 4);
        const matchingLocation = seoData.locations.find(loc => {
            const townSlug = slugify(loc.name.split(',')[0]);
            const countySlug = slugify(loc.region);
            return `${townSlug}-${countySlug}-ny` === locationPart;
        });
        if (matchingLocation) {
            return { type: 'LOCATION', data: { service: matchingService, location: matchingLocation } };
        }
    }

    // 4. Check if it's an Industry x Location page (e.g. /services/auto-dealerships-in-new-hyde-park-nassau-ny)
    const matchingIndustry = seoData.industries.find((i: any) => slug.startsWith(i.slug + '-in-'));
    if (matchingIndustry) {
        const locationPart = slug.substring(matchingIndustry.slug.length + 4);
        const matchingLocation = seoData.locations.find(loc => {
            const townSlug = slugify(loc.name.split(',')[0]);
            const countySlug = slugify(loc.region);
            return `${townSlug}-${countySlug}-ny` === locationPart;
        });
        if (matchingLocation) {
            return { type: 'LOCATION', data: { service: matchingIndustry, location: matchingLocation } };
        }
    }

    return { type: 'NOT_FOUND', data: null };
}
