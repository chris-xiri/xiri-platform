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
import { AskAnyAI } from '@/components/AskAnyAI';
import seoData from '@/data/seo-data.json';
import { SeoService } from '@xiri-facility-solutions/shared';
import { SITE } from '@/lib/constants';
// FIX: Add Lucide imports
import { MapPin, Eye } from 'lucide-react';
import { AuthorityBreadcrumb, getPillarForService } from '@/components/AuthorityBreadcrumb';
import { regionToCountyId, getCountySummary, getMarketWageContext } from '@/data/open-data';
import { CountyDataBar } from '@/components/CountyDataBar';
import { getServiceFaqProfile, getIndustryFaqProfile, type FaqEntry } from '@/data/service-faq-intelligence';

// ─── Typical Cost Data (P1: high-intent pricing queries) ────────────────────
// Ranges reflect commercial/institutional pricing in the Greater NY market.
// Updated quarterly; tied to BLS OES data and ISSA market benchmarks.
const PRICING_TABLE: Record<string, {
    rows: { scope: string; low: string; high: string; unit: string }[];
    note: string;
}> = {
    'medical-office-cleaning': {
        rows: [
            { scope: 'Small Practice (≤1,500 sq ft)', low: '$280', high: '$420', unit: '/month' },
            { scope: 'Mid-Size Clinic (1,500–4,000 sq ft)', low: '$420', high: '$780', unit: '/month' },
            { scope: 'Large Medical Group (4,000+ sq ft)', low: '$780', high: '$1,800', unit: '/month' },
            { scope: 'Terminal / Deep Clean (one-time)', low: '$350', high: '$900', unit: '/visit' },
        ],
        note: 'Ranges reflect OSHA-compliant disinfection protocols and nightly Night Manager audits. Final quote based on room count, traffic, and compliance tier.',
    },
    'janitorial-services': {
        rows: [
            { scope: 'Small Office (≤2,500 sq ft)', low: '$200', high: '$380', unit: '/month' },
            { scope: 'Mid-Size Office (2,500–7,500 sq ft)', low: '$380', high: '$720', unit: '/month' },
            { scope: 'Large Commercial (7,500+ sq ft)', low: '$720', high: '$2,200', unit: '/month' },
            { scope: 'Day Porter (add-on)', low: '$18', high: '$26', unit: '/hr' },
        ],
        note: 'Pricing includes background-checked crews, all supplies, and a dedicated Facility Success Manager. No hidden fees.',
    },
    'office-cleaning': {
        rows: [
            { scope: 'Executive Suite (≤1,200 sq ft)', low: '$150', high: '$280', unit: '/month' },
            { scope: 'Standard Office (1,200–4,000 sq ft)', low: '$280', high: '$560', unit: '/month' },
            { scope: 'Large Floor Plate (4,000+ sq ft)', low: '$560', high: '$1,500', unit: '/month' },
        ],
        note: 'Includes nightly cleaning, restroom sanitation, trash removal, and kitchen wipedown. One invoice per month.',
    },
    'commercial-cleaning': {
        rows: [
            { scope: 'Retail / Showroom (≤3,000 sq ft)', low: '$250', high: '$480', unit: '/month' },
            { scope: 'Mixed-Use Commercial (3,000–8,000 sq ft)', low: '$480', high: '$950', unit: '/month' },
            { scope: 'Industrial / Warehouse', low: '$0.06', high: '$0.12', unit: '/sq ft/month' },
        ],
        note: 'All commercial cleaning includes liability insurance certificate on request and digital service logs.',
    },
    'carpet-cleaning': {
        rows: [
            { scope: 'Spot / Traffic Lane Treatment', low: '$80', high: '$180', unit: '/visit' },
            { scope: 'Full Office (up to 2,000 sq ft)', low: '$180', high: '$380', unit: '/visit' },
            { scope: 'Large Facility (2,000–6,000 sq ft)', low: '$380', high: '$780', unit: '/visit' },
        ],
        note: 'Hot-water extraction standard; encapsulation available for occupied spaces. Dries in 2–4 hours.',
    },
    'floor-care': {
        rows: [
            { scope: 'Strip & Wax (per 1,000 sq ft)', low: '$120', high: '$220', unit: '/1,000 sq ft' },
            { scope: 'Scrub & Recoat', low: '$60', high: '$110', unit: '/1,000 sq ft' },
            { scope: 'Burnishing / Polishing', low: '$30', high: '$60', unit: '/1,000 sq ft' },
        ],
        note: 'Pricing varies by finish type (VCT, LVT, concrete). Includes all equipment and materials.',
    },
    'window-cleaning': {
        rows: [
            { scope: 'Interior Windows (per pane)', low: '$3', high: '$6', unit: '/pane' },
            { scope: 'Interior + Exterior (per pane)', low: '$5', high: '$10', unit: '/pane' },
            { scope: 'High-Rise (per floor)', low: '$800', high: '$2,500', unit: '/floor' },
        ],
        note: 'Ground-level and low-rise pricing. High-rise includes rigging, insurance surcharge, and permit coordination.',
    },
    'disinfection-services': {
        rows: [
            { scope: 'Electrostatic Spray (per 1,000 sq ft)', low: '$80', high: '$160', unit: '/1,000 sq ft' },
            { scope: 'ATP Surface Testing (add-on)', low: '$50', high: '$120', unit: '/visit' },
            { scope: 'Monthly Scheduled Program', low: '$250', high: '$600', unit: '/month' },
        ],
        note: 'EPA List N disinfectants used for all pathogens including SARS-CoV-2. SDS sheets provided on every visit.',
    },
    'post-construction-cleanup': {
        rows: [
            { scope: 'Phase 1 — Rough Cleanup', low: '$0.10', high: '$0.18', unit: '/sq ft' },
            { scope: 'Phase 2 — Final Cleanup', low: '$0.18', high: '$0.35', unit: '/sq ft' },
            { scope: 'Touch-Up / Punch List', low: '$150', high: '$400', unit: '/visit' },
        ],
        note: 'Pricing per square foot of gross floor area. Includes debris removal, surface wipedown, and floor finishing.',
    },
    'pressure-washing': {
        rows: [
            { scope: 'Sidewalks / Entryways', low: '$0.08', high: '$0.18', unit: '/sq ft' },
            { scope: 'Parking Lot (per 10,000 sq ft)', low: '$220', high: '$480', unit: '/visit' },
            { scope: 'Building Exterior (per story)', low: '$180', high: '$420', unit: '/story' },
        ],
        note: 'Hot-water pressure washing available for grease and heavy soiling. All runoff managed per local stormwater codes.',
    },
};

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
    lastVerified?: string;
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

    // 2. Service x Location combos (e.g. /services/medical-office-cleaning-in-garden-city-nassau-ny)
    for (const service of seoData.services) {
        for (const location of seoData.locations) {
            const countySlug = slugify(location.region);
            const townSlug = slugify(location.name.split(',')[0]);
            const stateSlug = "ny";
            params.push({ slug: `${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}` });
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
    'preventive-maintenance': { titlePrefix: 'Cost-Saving', compliance: 'OSHA + EPA', pitch: 'scheduled vendor coordination, verified service delivery, and compliance documentation — all under one invoice' },
};

// Fallback for any service not in the map
const DEFAULT_LOGIC = { titlePrefix: '100% OSHA-Compliant', compliance: 'OSHA', pitch: 'nightly-verified, $1M-insured contractors' };

// ─── Explicit Meta Descriptions (max 155 chars each) ───
const META_DESCRIPTIONS: Record<string, string> = {
    'medical-office-cleaning': 'OSHA + HIPAA compliant medical office cleaning. Nightly verified, $1M insured. One partner for janitorial, supplies & compliance.',
    'urgent-care-cleaning': 'Rapid-turnover sterile cleaning for urgent care centers. OSHA + HIPAA compliant, nightly verified. One partner, one invoice.',
    'surgery-center-cleaning': 'AAAHC audit-ready surgery center cleaning. Terminal cleaning with AORN-standard OR protocols. Nightly verified, $1M insured.',
    'daycare-cleaning': 'Child-safe daycare cleaning with non-toxic Green Seal products. CDC compliant, background-checked crews. Free walkthrough available.',
    'commercial-cleaning': 'Nightly-verified commercial cleaning for offices and retail. $1M insured contractors, one invoice, zero headaches. Get a free scope.',
    'janitorial-services': '365 nights/yr audited janitorial services. $1M-insured, background-checked crews. One partner replaces cleaning, supplies & compliance.',
    'floor-care': 'OSHA-compliant floor care: VCT waxing, tile scrubbing, carpet extraction. Slip/fall prevention documented. Free walkthrough available.',
    'disinfecting-services': 'EPA-registered disinfection with documented kill-rate protocols. CDC compliant, nightly verified. One partner, one invoice.',
    'carpet-upholstery': 'Commercial carpet and upholstery deep cleaning. EPA-compliant products, scheduled service, nightly verified. Free estimate available.',
    'window-cleaning': 'Fully insured commercial window cleaning. Scheduled, inspected, and verified. $1M liability coverage. Free walkthrough available.',
    'pressure-washing': 'EPA-compliant commercial pressure washing with OSHA safety protocols. Documented runoff management. Free site assessment.',
    'day-porter': 'Daytime facility monitoring with documented shift logs. Real-time reporting, $1M insured. One partner for lobby, restrooms & common areas.',
    'snow-ice-removal': 'Liability-protected snow and ice removal. OSHA-compliant slip/fall prevention — every event documented and audited. Free scope.',
    'hvac-maintenance': 'EPA-compliant HVAC maintenance for occupied commercial facilities. Documented air quality management. Free walkthrough available.',
    'pest-control': 'Integrated pest management meeting local health code standards. EPA compliant, documented treatments. Free site assessment.',
    'waste-management': 'Documented chain-of-custody waste handling with EPA compliance. OSHA-compliant, nightly verified. One partner, one invoice.',
    'parking-lot-maintenance': 'ADA-compliant parking lot maintenance. Sweeping, striping, slip/fall prevention. $1M insured, documented. Free walkthrough.',
    'handyman-services': 'Fully insured, background-checked maintenance crews. $1M liability, documented work orders. One partner for all facility repairs.',
    'post-construction-cleanup': 'Professional post-construction cleanup for commercial spaces. Dust removal, floor finishing, final inspection. $1M insured.',
    'preventive-maintenance': 'Preventive maintenance programs for commercial buildings. Scheduled cleaning, pest control, HVAC, handyman — all coordinated under one invoice.',
};

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'SERVICE') {
        const service = data as any;
        const logic = MEDICAL_LOGIC[service.slug] || DEFAULT_LOGIC;
        // Title: service name + compliance prefix + short brand (under 60 chars)
        const title = `${service.heroTitle || service.name} — ${logic.titlePrefix} | XIRI`;
        // Description: use explicit description if available, otherwise auto-generate
        const description = META_DESCRIPTIONS[service.slug] || `${service.shortDescription} ${logic.pitch}. 1 partner, 1 invoice, 365 nights/yr verified.`.slice(0, 155);
        return {
            title,
            description,
            alternates: {
                canonical: `${SITE.url}/services/${service.slug}`
            },
            openGraph: {
                title,
                description,
                url: `${SITE.url}/services/${service.slug}`,
                siteName: SITE.name,
                type: 'website',
            },
        };
    } else if (type === 'LOCATION') {
        const { service, location } = data as { service: any; location: Location };
        const logic = MEDICAL_LOGIC[service.slug] || DEFAULT_LOGIC;
        // Title: service + location + short brand (under 60 chars)
        const title = `${service.name} in ${location.name} | XIRI`;
        // Description: local hook + surgical pitch + numbers + CTA
        const localHook = location.localInsight
            ? `${location.localInsight} `
            : '';
        const description = `${localHook}${service.name} in ${location.name} — ${logic.pitch}. $1M-insured, 1 invoice. ${logic.compliance} audit-ready. Free walkthrough →`.slice(0, 155);

        return {
            title,
            description,
            alternates: {
                canonical: `${SITE.url}/services/${slug}`
            },
            openGraph: {
                title,
                description,
                url: `${SITE.url}/services/${slug}`,
                siteName: SITE.name,
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
                        "@graph": [
                            {
                                "@type": "Service",
                                "@id": `${SITE.url}/services/${service.slug}#service`,
                                "name": service.heroTitle || service.name,
                                "description": service.shortDescription,
                                "serviceType": service.name,
                                "provider": {
                                    "@type": "Organization",
                                    "@id": `${SITE.url}/#organization`
                                },
                                "areaServed": {
                                    "@type": "State",
                                    "name": "New York"
                                },
                                ...(getPillarForService(service.slug).href !== `/services/${service.slug}` && {
                                    "isPartOf": {
                                        "@type": "Service",
                                        "@id": `${SITE.url}${getPillarForService(service.slug).href}#service`
                                    }
                                })
                            },
                            ...(service.faqs && service.faqs.length > 0 ? [{
                                "@type": "FAQPage",
                                "mainEntity": service.faqs.map((faq: any) => ({
                                    "@type": "Question",
                                    "name": faq.question,
                                    "acceptedAnswer": {
                                        "@type": "Answer",
                                        "text": faq.answer
                                    }
                                }))
                            }] : [])
                        ]
                    }}
                />
                <JsonLd
                    data={{
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                            { "@type": "ListItem", "position": 2, "name": getPillarForService(service.slug).text, "item": `${SITE.url}${getPillarForService(service.slug).href}` },
                            { "@type": "ListItem", "position": 3, "name": service.name, "item": `${SITE.url}/services/${service.slug}` },
                        ]
                    }}
                />
                <AuthorityBreadcrumb items={[{ label: service.name }]} pillar={getPillarForService(service.slug)} />
                <Hero
                    title={service.heroTitle || service.name}
                    subtitle={service.heroSubtitle || service.shortDescription}
                    ctaText="Get a Quote"
                />
                <ValuePropsSection
                    title={`Why Choose ${SITE.shortName} for ${service.name}`}
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

                {/* ═══ PRICING / CALCULATOR CTA ═══ */}
                {(() => {
                    const CLEANING_SERVICES = [
                        'medical-office-cleaning', 'urgent-care-cleaning', 'surgery-center-cleaning',
                        'daycare-cleaning', 'commercial-cleaning', 'janitorial-services',
                        'day-porter', 'disinfecting-services',
                    ];
                    const isCleaning = CLEANING_SERVICES.includes(service.slug);

                    if (isCleaning) {
                        return (
                            <section className="py-12 bg-sky-50 border-y border-sky-100">
                                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                                        💰 How Much Does {service.name} Cost?
                                    </h2>
                                    <p className="text-slate-600 mb-2 max-w-2xl mx-auto">
                                        Get an instant estimate with our free janitorial cleaning cost calculator. Enter your square footage, facility type, and state — results in seconds.
                                    </p>
                                    <p className="text-sm text-slate-500 mb-6">Used by 20+ facilities across New York · No sign-up required</p>
                                    <Link
                                        href="/calculator"
                                        className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                                    >
                                        Get Your Instant Estimate →
                                    </Link>
                                </div>
                            </section>
                        );
                    }
                    return (
                        <section className="py-12 bg-sky-50 border-y border-sky-100">
                            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                                <h2 className="text-2xl font-bold text-slate-900 mb-3">
                                    Need {service.name} for Your Facility?
                                </h2>
                                <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                                    Every facility is different. We'll walk your property, build a custom scope, and match you with vetted, $1M-insured contractors — all under one invoice.
                                </p>
                                <Link
                                    href="/#audit"
                                    className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                                >
                                    Request a Custom Quote →
                                </Link>
                            </div>
                        </section>
                    );
                })()}

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
                                    From daily janitorial to specialized floor care, {SITE.shortName} manages every aspect of your facility under one roof.
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

    // Open-data: county-level demographics + wage context
    const countyId = regionToCountyId(location.region);
    const countySummary = countyId ? getCountySummary(countyId) : null;
    const wageContext = countyId ? getMarketWageContext(countyId) : null;

    // Inject Landmarks into Hero
    const heroTitle = `${service.name} in ${location.name}`;
    const heroSubtitle = location.localInsight
        || `${service.shortDescription} Proudly serving medical facilities near ${location.landmarks?.join(', ') || location.region}.`;

    // ═══ SERVICE-SPECIFIC FAQ INTELLIGENCE ═══
    // Uses per-service-category intelligence backed by ISSA, CDC, BLS, OSHA,
    // EPA, and Liberty Mutual — every service slug now gets unique FAQ content.
    const faqProfile = getServiceFaqProfile(service.slug);
    const dataFaqs: FaqEntry[] = [];

    // 1. Coverage area FAQ (always present — location-specific)
    dataFaqs.push({
        question: `What zip codes does XIRI cover for ${service.name} in ${townName}?`,
        answer: `We provide ${service.name.toLowerCase()} services across zip codes ${location.zipCodes?.join(', ') || 'in the surrounding area'}, covering all of ${location.region}. Our crews are already on established routes in these areas, so adding your facility means zero ramp-up time.`,
    });

    // 2. Service-specific quality & retention FAQ (when we have wage data)
    if (wageContext) {
        dataFaqs.push(
            faqProfile.qualityFaq(
                townName,
                wageContext.medianHourly,
                wageContext.premiumPct,
                wageContext.areaTitle,
                wageContext.minWage,
            ),
        );
    }

    // 3. Service-specific competitive landscape FAQ (when we have competitor data)
    if (countySummary && countySummary.janitorialCompetitors > 0) {
        dataFaqs.push(
            faqProfile.competitorFaq(townName, location.region, countySummary.janitorialCompetitors),
        );
    }

    // 4. Service-specific pricing FAQ
    dataFaqs.push(
        faqProfile.pricingFaq(townName, service.name),
    );

    // 5. Service-specific compliance/insurance FAQ
    dataFaqs.push(
        faqProfile.complianceFaq(townName, service.name),
    );

    // 6. Bonus FAQ unique to this service category (when available)
    if (faqProfile.bonusFaq) {
        dataFaqs.push(
            faqProfile.bonusFaq(townName, service.name),
        );
    }

    const allFaqs = [
        ...(location.localFaqs || []),
        ...(service.faqs || []),
        ...dataFaqs,
    ];

    // Enhanced JSON-LD: LocalBusiness + Service + FAQPage
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            '@id': `${SITE.url}/services/${slug}#business`,
            name: `${SITE.shortName} ${service.name} — ${location.name}`,
            description: location.localInsight || service.shortDescription,
            image: `${SITE.url}/xiri-logo-horizontal.svg`,
            url: `${SITE.url}/services/${slug}`,
            telephone: SITE.phone,
            ...(location.lastVerified && { dateModified: location.lastVerified }),
            priceRange: '$$',
            areaServed: {
                '@type': 'Place',
                name: location.region,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: townName,
                    addressRegion: location.state,
                    postalCode: location.zipCodes?.[0],
                    addressCountry: 'US',
                },
            },
            geo: {
                '@type': 'GeoCoordinates',
                latitude: location.latitude,
                longitude: location.longitude,
            },
            openingHoursSpecification: {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                opens: '00:00',
                closes: '23:59',
            },
            department: {
                '@type': 'ProfessionalService',
                name: service.name,
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE.url}/services/${slug}#service`,
            name: `${service.name} in ${location.name}`,
            description: service.shortDescription,
            provider: {
                '@type': 'LocalBusiness',
                '@id': `${SITE.url}/services/${slug}#business`,
            },
            areaServed: {
                '@type': 'Place',
                name: `${townName}, ${location.state}`,
            },
            serviceType: service.name,
            ...(PRICING_TABLE[service.slug] && {
                offers: {
                    '@type': 'AggregateOffer',
                    priceCurrency: 'USD',
                    lowPrice: PRICING_TABLE[service.slug].rows[0].low.replace(/[^0-9.]/g, ''),
                    highPrice: PRICING_TABLE[service.slug].rows[PRICING_TABLE[service.slug].rows.length - 1].high.replace(/[^0-9.]/g, ''),
                    offerCount: PRICING_TABLE[service.slug].rows.length,
                    description: PRICING_TABLE[service.slug].note,
                    url: `${SITE.url}/services/${slug}#pricing`,
                },
            }),
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
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": getPillarForService(service.slug).text, "item": `${SITE.url}${getPillarForService(service.slug).href}` },
                        { "@type": "ListItem", "position": 3, "name": service.name, "item": `${SITE.url}/services/${service.slug}` },
                        { "@type": "ListItem", "position": 4, "name": `${townName}, NY`, "item": `${SITE.url}/services/${slug}` },
                    ]
                }}
            />
            <ServiceTracker service={service.slug} location={location.slug} />

            {/* Dynamic Hero */}
            <AuthorityBreadcrumb items={[
                { label: service.name, href: `/services/${service.slug}` },
                { label: `${townName}, NY` },
            ]} pillar={getPillarForService(service.slug)} />
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
                            <div className="text-2xl font-bold text-sky-400">
                                {countySummary
                                    ? countySummary.totalBusinesses >= 1000
                                        ? `${(countySummary.totalBusinesses / 1000).toFixed(1)}K`
                                        : countySummary.totalBusinesses.toLocaleString('en-US')
                                    : '10+'}
                            </div>
                            <div className="text-sm text-slate-300 mt-1">
                                {countySummary ? 'Business Establishments' : 'Facilities in Area'}
                            </div>
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

            {/* ═══ COUNTY DATA BAR — open-data enrichment ═══ */}
            {countySummary && (
                <CountyDataBar
                    summary={countySummary}
                    wageContext={wageContext ?? null}
                    industryName={service.name}
                    townName={townName}
                />
            )}

            {/* ═══ LOCAL INSIGHT — unique per town ═══ */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-bold">
                                    Local Market Intelligence
                                </div>
                                {location.lastVerified && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        Data verified {new Date(location.lastVerified + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}
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
                        How {service.name} Works with {SITE.shortName}
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

            {/* ═══ LOCAL MARKET PULSE (from location data) ═══ */}
            {location.keyIntersection && (
            <section className="py-20 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 relative h-96 rounded-2xl overflow-hidden shadow-xl border border-slate-100">
                            {location.latitude ? (
                                <iframe
                                    title={`Map of ${townName}, ${location.region || 'NY'}`}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${location.latitude},${location.longitude}&zoom=14`}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <MapPin className="w-8 h-8" />
                                        </div>
                                        <p className="font-bold text-slate-400">Service Area</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="order-1 md:order-2">
                            <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-bold mb-6">
                                Already Serving Your Area
                            </div>
                            <h2 className="text-3xl font-bold font-heading text-slate-900 mb-6">
                                {service.name} Near {townName}
                            </h2>
                            <div className="space-y-6 text-lg text-slate-600">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-1">Local Crews, Not Drive-Ins</h3>
                                        <p>We already serve facilities along <strong className="text-slate-900">{location.keyIntersection}</strong> — your building gets added to an existing route, meaning faster response and crews who know the area.</p>
                                    </div>
                                </div>
                                {location.landmarks && location.landmarks.length > 0 && (
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                            <Eye className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 mb-1">Nearby Facilities We Serve</h3>
                                            <p>Our teams operate near <strong className="text-slate-900">{location.landmarks.slice(0, 2).join(' & ')}</strong> — adding your facility means zero ramp-up time.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            )}

            <ValuePropsSection title={`Our Standard for ${townName}`} />

            {/* ═══ TYPICAL COST TABLE — P1: high-intent pricing queries ═══ */}
            {PRICING_TABLE[service.slug] && (
                <section className="py-16 bg-white border-b border-slate-200" id="pricing">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-10">
                            <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-bold mb-4">
                                Pricing Transparency
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900">
                                Typical {service.name} Cost in {townName}
                            </h2>
                            <p className="mt-3 text-slate-500 max-w-2xl mx-auto">
                                Market ranges for {location.region} — actual quote depends on your facility&apos;s scope, frequency, and compliance requirements.
                            </p>
                        </div>

                        {/* Pricing table */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        <th className="px-6 py-4 text-left font-semibold">Scope</th>
                                        <th className="px-4 py-4 text-center font-semibold">Low</th>
                                        <th className="px-4 py-4 text-center font-semibold">High</th>
                                        <th className="px-4 py-4 text-left font-semibold">Unit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {PRICING_TABLE[service.slug].rows.map((row, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="px-6 py-4 font-medium text-slate-800">{row.scope}</td>
                                            <td className="px-4 py-4 text-center text-emerald-700 font-bold">{row.low}</td>
                                            <td className="px-4 py-4 text-center text-emerald-700 font-bold">{row.high}</td>
                                            <td className="px-4 py-4 text-slate-500">{row.unit}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Note + CTA */}
                        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <p className="text-sm text-slate-500 flex-1">
                                ⓘ {PRICING_TABLE[service.slug].note}
                            </p>
                            <CTAButton
                                href="/#audit"
                                text="Get Your Free Quote"
                                className="shrink-0 bg-sky-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors"
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ COMBINED FAQs (location-specific + service + data-driven) ═══ */}
            <section className="py-16 bg-slate-50" id="faq">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">
                        {service.name} in {townName} — Frequently Asked Questions
                    </h2>
                    <p className="text-center text-slate-500 mb-10 max-w-2xl mx-auto">
                        Common questions from facility managers about {service.name.toLowerCase()} services in {location.region}.
                    </p>
                    <div className="space-y-3">
                        {allFaqs.map((faq, i) => (
                            <details
                                key={i}
                                className="group bg-white rounded-xl shadow-sm border border-slate-200 hover:border-sky-200 transition-colors"
                                {...(i === 0 ? { open: true } : {})}
                            >
                                <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-left font-semibold text-slate-900 select-none [&::-webkit-details-marker]:hidden list-none">
                                    <span className="pr-4">{faq.question}</span>
                                    <svg
                                        className="w-5 h-5 flex-shrink-0 text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="px-6 pb-5 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                                    {faq.answer}
                                    {/* Source citation badges */}
                                    {('sources' in faq) && (faq as FaqEntry).sources && (faq as FaqEntry).sources!.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider self-center">Sources:</span>
                                            {(faq as FaqEntry).sources!.map((src, si) => (
                                                <a
                                                    key={si}
                                                    href={src.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-full text-xs font-medium text-sky-700 hover:text-sky-900 transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                                                    </svg>
                                                    {src.name}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-6">
                        All claims cite authoritative sources. Click any badge above to verify. Market data: BLS OES (May 2023), Census Bureau County Business Patterns.
                    </p>
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

            {/* ═══ CALCULATOR CTA ═══ */}
            <section className="py-12 bg-sky-50 border-y border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        💰 Estimate Your {service.name} Cost in {townName}
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Use our free commercial cleaning cost calculator to see what janitorial services should cost for your facility size and type.
                    </p>
                    <Link
                        href="/calculator"
                        className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                    >
                        Try the Cost Calculator →
                    </Link>
                </div>
            </section>

            {/* ═══ ASK ANY AI ═══ */}
            <section className="py-10 bg-white border-b border-slate-100">
                <div className="max-w-3xl mx-auto px-4">
                    <AskAnyAI variant="card" heading={`Research ${service.name} with AI`} />
                </div>
            </section>

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

    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 2. Check if it's a Service x Location page
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

    return { type: 'NOT_FOUND', data: null };
}
