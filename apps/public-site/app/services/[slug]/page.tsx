import { notFound, redirect } from 'next/navigation';
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
import { getServiceHeroSlides } from '@/lib/hero-media';

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
    'auto-detailing': {
        rows: [
            { scope: 'Basic Fleet Wash (Exterior)', low: '$15', high: '$35', unit: '/vehicle' },
            { scope: 'Showroom Detail (Cars/SUVs)', low: '$80', high: '$150', unit: '/vehicle' },
            { scope: 'Full Reconditioning / Lease Return', low: '$150', high: '$350', unit: '/vehicle' },
        ],
        note: 'Pricing depends on volume, vehicle size, and frequency. All wash water is recovered per EPA regulations.',
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
    'auto-detailing': { titlePrefix: 'EPA-Compliant', compliance: 'EPA + OSHA', pitch: 'EPA water recovery compliant, showroom-quality auto detailing for fleets and dealerships' },
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
    'auto-detailing': 'EPA-compliant commercial auto detailing for dealerships and fleets. High-volume fleet washing and showroom reconditioning. $1M insured.',
};

const LEAD_CTR_SERVICE_SLUGS = new Set([
    'janitorial-services',
    'commercial-cleaning',
]);

const VERIFIED_CLEANING_CTA_SLUGS = new Set([
    'janitorial-services',
    'commercial-cleaning',
]);

const LEAD_CTR_SERVICE_META: Record<string, { title: string; description: string }> = {
    'janitorial-services': {
        title: 'Janitorial Services Pricing & Quotes (2026)',
        description: 'Compare local janitorial services pricing for offices and commercial buildings. Get monthly cost ranges and request a verified quote.',
    },
    'commercial-cleaning': {
        title: 'Commercial Cleaning Services Pricing & Quotes (2026)',
        description: 'Compare commercial cleaning services and monthly janitorial pricing for offices, medical facilities, and retail sites.',
    },
};

function truncateSeoTitle(input: string): string {
    if (input.length <= 60) {
        return input;
    }
    return `${input.slice(0, 57).trimEnd()}...`;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'SERVICE') {
        const service = data as any;
        const logic = MEDICAL_LOGIC[service.slug] || DEFAULT_LOGIC;
        const leadCtrMeta = LEAD_CTR_SERVICE_META[service.slug];
        const title = leadCtrMeta?.title || `${service.heroTitle || service.name} — ${logic.titlePrefix} | XIRI`;
        const description =
            leadCtrMeta?.description ||
            META_DESCRIPTIONS[service.slug] ||
            `${service.shortDescription} ${logic.pitch}. 1 partner, 1 invoice, 365 nights/yr verified.`.slice(0, 155);
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
        const townName = location.name.split(',')[0]?.trim() || location.name;
        const isLeadCtrSlug = LEAD_CTR_SERVICE_SLUGS.has(service.slug);
        const title = isLeadCtrSlug
            ? truncateSeoTitle(`${service.name} ${townName}, ${location.state} | Free Quote`)
            : `${service.name} in ${location.name} | XIRI`;
        const localHook = location.localInsight ? `${location.localInsight} ` : '';
        const description = isLeadCtrSlug
            ? `${service.name} in ${townName}, ${location.state}. Compare local monthly pricing, review scope options, and request a verified quote.`.slice(0, 155)
            : `${localHook}${service.name} in ${location.name} — ${logic.pitch}. $1M-insured, 1 invoice. ${logic.compliance} audit-ready. Free walkthrough →`.slice(0, 155);

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
                    ctaText={VERIFIED_CLEANING_CTA_SLUGS.has(service.slug) ? 'Get Verified Cleaning' : 'Get a Quote'}
                    mediaSlides={getServiceHeroSlides(service.slug)}
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
                    const isLeadCtrService = LEAD_CTR_SERVICE_SLUGS.has(service.slug);

                    if (isCleaning) {
                        return (
                            <section className="py-12 bg-sky-50 border-y border-sky-100">
                                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                                        {isLeadCtrService
                                            ? '💰 Get Instant Pricing with the Cost Calculator'
                                            : `💰 How Much Does ${service.name} Cost?`}
                                    </h2>
                                    <p className="text-slate-600 mb-2 max-w-2xl mx-auto">
                                        {isLeadCtrService
                                            ? 'This page explains service scope and delivery. For instant pricing, use our calculator with your square footage, facility type, and state.'
                                            : 'Get an instant estimate with our free janitorial cleaning cost calculator. Enter your square footage, facility type, and state — results in seconds.'}
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
                    const isLeadCtrService = LEAD_CTR_SERVICE_SLUGS.has(service.slug);
                    const otherServices = seoData.services
                        .filter(s => s.slug !== service.slug)
                        .filter(s => !(isLeadCtrService && LEAD_CTR_SERVICE_SLUGS.has(s.slug)))
                        .slice(0, 6);
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

    // --- CASE B: Service Location Page (REDIRECT TO NEW STRUCTURE) ---
    const { service, location } = data as { service: any, location: any };
    const slugifyStr = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const countySlug = slugifyStr(location.region);
    const townSlug = slugifyStr(location.name.split(',')[0]);
    const stateSlug = slugifyStr(location.state);
    
    // Redirect permanently (301) to the new local pSEO structure
    redirect(`/locations/${stateSlug}/${countySlug}/${townSlug}/${service.slug}`);
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
