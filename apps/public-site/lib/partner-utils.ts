/**
 * Partner Directory Utilities
 *
 * Shared helpers for the /partners pSEO pages.
 * Handles vendor fetching, slugification, capability metadata,
 * and SEO content generation.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vendor } from '@xiri-facility-solutions/shared';
import { getTaxRate } from '@xiri-facility-solutions/shared';

// ─── Service County Labels (mirrors dashboard) ───────────────────
export const SERVICE_COUNTY_LABELS: Record<string, string> = {
  new_york:    'Manhattan',
  kings:       'Brooklyn',
  queens:      'Queens',
  bronx:       'Bronx',
  richmond:    'Staten Island',
  nassau:      'Nassau County',
  suffolk:     'Suffolk County',
  westchester: 'Westchester County',
  rockland:    'Rockland County',
  orange:      'Orange County',
  dutchess:    'Dutchess County',
  bergen:      'Bergen County, NJ',
  hudson:      'Hudson County, NJ',
  essex:       'Essex County, NJ',
  passaic:     'Passaic County, NJ',
};

// ─── Certifications by Capability ────────────────────────────────
export interface CertificationOption {
  value: string;
  label: string;
  capabilities: string[];
}

export const CERTIFICATIONS: CertificationOption[] = [
  // Plumbing
  { value: 'nys_lmp',                  label: 'NYS Licensed Master Plumber',              capabilities: ['plumbing'] },
  { value: 'nyc_lmp',                  label: 'NYC Licensed Master Plumber',               capabilities: ['plumbing'] },
  { value: 'nys_backflow_tester',      label: 'NYS Backflow Prevention Tester',            capabilities: ['plumbing'] },
  { value: 'nyc_fire_suppression',     label: 'NYC Fire Suppression Piping License',       capabilities: ['plumbing'] },
  // HVAC
  { value: 'epa_608',                  label: 'EPA Section 608 Certification',             capabilities: ['hvac'] },
  { value: 'epa_608_universal',        label: 'EPA 608 Universal',                         capabilities: ['hvac'] },
  { value: 'nate_certified',           label: 'NATE Certified Technician',                 capabilities: ['hvac'] },
  { value: 'nyc_refrig_op',            label: 'NYC Refrigerating System Operator',         capabilities: ['hvac'] },
  // Electrical
  { value: 'nyc_electrician_license',  label: 'NYC Electrician License',                   capabilities: ['electrical'] },
  { value: 'nys_electrician_license',  label: 'NYS Electrician License',                   capabilities: ['electrical'] },
  { value: 'osha_10',                  label: 'OSHA 10-Hour Construction',                 capabilities: ['electrical', 'plumbing', 'hvac', 'roofing', 'painting', 'elevator'] },
  { value: 'osha_30',                  label: 'OSHA 30-Hour Construction',                 capabilities: ['electrical', 'plumbing', 'hvac', 'roofing', 'painting', 'elevator'] },
  // Fire Safety
  { value: 'nyc_fire_guard',           label: 'NYC Certificate of Fitness (Fire Guard)',   capabilities: ['fire_safety'] },
  { value: 'nyc_cof_s12',             label: 'NYC CoF S-12 (Sprinkler)',                  capabilities: ['fire_safety', 'plumbing'] },
  { value: 'nyc_cof_s13',             label: 'NYC CoF S-13 (Standpipe)',                  capabilities: ['fire_safety', 'plumbing'] },
  { value: 'nys_fire_extinguisher',    label: 'NYS Fire Extinguisher Technician',          capabilities: ['fire_safety'] },
  // Elevator
  { value: 'nyc_elevator_agency',      label: 'NYC Elevator Agency Director License',      capabilities: ['elevator'] },
  { value: 'qei_certified',           label: 'QEI Certified Elevator Inspector',          capabilities: ['elevator'] },
  // Pest Control
  { value: 'nysdec_pest_applicator',   label: 'NYSDEC Pesticide Applicator License',       capabilities: ['pest_control'] },
  { value: 'nysdec_pest_tech',         label: 'NYSDEC Commercial Pest Technician',         capabilities: ['pest_control'] },
  // General / Cleaning
  { value: 'issa_cims',               label: 'ISSA CIMS Certification',                   capabilities: ['janitorial', 'commercial_cleaning'] },
  { value: 'gbac_star',               label: 'GBAC STAR Accreditation',                   capabilities: ['janitorial', 'commercial_cleaning', 'disinfecting'] },
  { value: 'iicrc_certified',         label: 'IICRC Certified Technician',                capabilities: ['carpet_upholstery', 'floor_care'] },
  // Landscaping
  { value: 'nys_pesticide_applicator', label: 'NYS Pesticide Applicator (Landscaping)',    capabilities: ['landscaping'] },
  { value: 'nys_arborist',            label: 'ISA Certified Arborist',                    capabilities: ['landscaping'] },
  // General
  { value: 'general_liability_ins',    label: 'General Liability Insurance ($1M+)',         capabilities: [] },
  { value: 'workers_comp',            label: "Workers' Compensation Certificate",          capabilities: [] },
];

// ─── Status Gates ────────────────────────────────────────────────
export const PUBLISHABLE_STATUSES = ['ready_for_assignment', 'active'] as const;
export const OFFBOARDED_STATUSES  = ['suspended', 'dismissed'] as const;

export type PublishableStatus = (typeof PUBLISHABLE_STATUSES)[number];
export type OffboardedStatus  = (typeof OFFBOARDED_STATUSES)[number];

// ─── Capability Metadata ─────────────────────────────────────────

export interface CapabilityMeta {
  value: string;
  label: string;
  slug: string;
  group: 'cleaning' | 'facility' | 'specialty';
  groupLabel: string;
  seoTitle: string;
  seoDescription: string;
  definitionBlock: string;
  icon: string; // Lucide icon name
}

/** All 22 capabilities with SEO-optimized metadata */
export const CAPABILITY_DIRECTORY: CapabilityMeta[] = [
  // ── Cleaning ──
  {
    value: 'janitorial', label: 'Janitorial Services', slug: 'janitorial-services',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'Sparkles',
    seoTitle: 'Vetted Janitorial Service Contractors | XIRI Partners',
    seoDescription: 'Find XIRI-vetted janitorial service contractors with $1M+ liability insurance, background checks, and nightly verification. Serving the NY metro area.',
    definitionBlock: 'XIRI\'s janitorial service partners are compliance-verified commercial cleaning contractors who provide daily, nightly, and deep-clean janitorial services for offices, medical facilities, and retail spaces across the New York metro area.',
  },
  {
    value: 'commercial_cleaning', label: 'Commercial Cleaning', slug: 'commercial-cleaning',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'SprayCan',
    seoTitle: 'Commercial Cleaning Contractors | XIRI Partners',
    seoDescription: 'Hire vetted commercial cleaning contractors through XIRI. Every partner carries $1M+ insurance and passes compliance verification. NY metro area.',
    definitionBlock: 'XIRI\'s commercial cleaning partners deliver scheduled and on-demand cleaning services for offices, retail, and industrial facilities. Each contractor is insurance-verified and compliance-checked before joining the network.',
  },
  {
    value: 'floor_care', label: 'Floor Care', slug: 'floor-care',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'Layers',
    seoTitle: 'Commercial Floor Care Contractors | XIRI Partners',
    seoDescription: 'Vetted floor care specialists for VCT stripping, waxing, hardwood refinishing, and concrete polishing. XIRI-verified contractors in the NY metro area.',
    definitionBlock: 'XIRI\'s floor care partners specialize in VCT stripping and waxing, hardwood refinishing, concrete polishing, and tile restoration for commercial properties. All contractors carry specialized equipment and IICRC certifications.',
  },
  {
    value: 'carpet_upholstery', label: 'Carpet & Upholstery', slug: 'carpet-upholstery',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'Sofa',
    seoTitle: 'Commercial Carpet & Upholstery Cleaning | XIRI Partners',
    seoDescription: 'IICRC-certified carpet and upholstery cleaning contractors verified by XIRI. Hot water extraction, encapsulation, and specialty fabric care.',
    definitionBlock: 'XIRI\'s carpet and upholstery partners provide IICRC-certified deep cleaning, stain removal, and restoration services for commercial offices, healthcare facilities, and hospitality venues across the NY metro area.',
  },
  {
    value: 'window_cleaning', label: 'Window Cleaning', slug: 'window-cleaning',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'PanelTop',
    seoTitle: 'Commercial Window Cleaning Contractors | XIRI Partners',
    seoDescription: 'Licensed and insured commercial window cleaning contractors in the NY metro area. Interior, exterior, and high-rise capabilities.',
    definitionBlock: 'XIRI\'s window cleaning partners handle interior, exterior, and high-rise window cleaning for commercial buildings. Each contractor carries specialized liability coverage and OSHA fall-protection certifications.',
  },
  {
    value: 'pressure_washing', label: 'Pressure Washing', slug: 'pressure-washing',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'Droplets',
    seoTitle: 'Commercial Pressure Washing Services | XIRI Partners',
    seoDescription: 'Vetted commercial pressure washing contractors for building facades, parking structures, sidewalks, and dumpster pads. XIRI-verified.',
    definitionBlock: 'XIRI\'s pressure washing partners provide EPA-compliant exterior cleaning for building facades, parking structures, sidewalks, loading docks, and dumpster areas. All contractors carry wastewater recovery equipment where required.',
  },
  {
    value: 'disinfecting', label: 'Disinfecting Services', slug: 'disinfecting-services',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'ShieldCheck',
    seoTitle: 'Disinfecting & Sanitization Contractors | XIRI Partners',
    seoDescription: 'GBAC STAR-accredited disinfection contractors verified by XIRI. Electrostatic spraying, UV-C treatment, and CDC-compliant protocols.',
    definitionBlock: 'XIRI\'s disinfection partners use CDC-compliant protocols including electrostatic spraying and EPA-registered disinfectants for healthcare facilities, schools, and commercial buildings. GBAC STAR accreditation available.',
  },
  {
    value: 'day_porter', label: 'Day Porters', slug: 'day-porters',
    group: 'cleaning', groupLabel: 'Cleaning',
    icon: 'UserCheck',
    seoTitle: 'Day Porter Services | XIRI Partners',
    seoDescription: 'Reliable day porter contractors for lobbies, restrooms, and common areas. Background-checked and XIRI-verified. NY metro area.',
    definitionBlock: 'XIRI\'s day porter partners provide daytime cleaning and maintenance for high-traffic commercial lobbies, restrooms, breakrooms, and common areas. All porters are background-checked and NFC-verified on each shift.',
  },

  // ── Facility / Maintenance ──
  {
    value: 'hvac', label: 'HVAC Maintenance', slug: 'hvac-maintenance',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Thermometer',
    seoTitle: 'Commercial HVAC Contractors | XIRI Partners',
    seoDescription: 'EPA 608-certified HVAC contractors for commercial buildings. Preventive maintenance, repair, and installation. XIRI-verified and insured.',
    definitionBlock: 'XIRI\'s HVAC partners are EPA Section 608-certified technicians providing preventive maintenance, emergency repair, and system installation for commercial rooftop units, split systems, and VRF systems across the NY metro area.',
  },
  {
    value: 'plumbing', label: 'Plumbing', slug: 'plumbing',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Wrench',
    seoTitle: 'Licensed Commercial Plumbers | XIRI Partners',
    seoDescription: 'NYS-licensed master plumbers for commercial buildings. Backflow testing, drain cleaning, water heaters, and emergency service. XIRI-verified.',
    definitionBlock: 'XIRI\'s plumbing partners are NYS-licensed master plumbers specializing in commercial backflow prevention, drain maintenance, water heater service, and emergency repairs for office buildings, medical facilities, and retail spaces.',
  },
  {
    value: 'electrical', label: 'Electrical', slug: 'electrical',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Zap',
    seoTitle: 'Licensed Commercial Electricians | XIRI Partners',
    seoDescription: 'NYC/NYS-licensed commercial electricians for panel upgrades, lighting, code compliance, and emergency service. XIRI-verified.',
    definitionBlock: 'XIRI\'s electrical partners are NYC or NYS-licensed electricians providing commercial panel upgrades, LED retrofits, code compliance inspections, and 24/7 emergency service for facilities across the NY metro area.',
  },
  {
    value: 'handyman', label: 'Handyman Services', slug: 'handyman-services',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Hammer',
    seoTitle: 'Commercial Handyman Services | XIRI Partners',
    seoDescription: 'Vetted commercial handyman contractors for drywall, painting, fixture installation, and general repairs. XIRI-verified and insured.',
    definitionBlock: 'XIRI\'s handyman partners handle day-to-day commercial maintenance including drywall repair, fixture installation, light carpentry, and general building upkeep. All contractors carry $1M+ general liability insurance.',
  },
  {
    value: 'landscaping', label: 'Landscaping', slug: 'landscaping',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'TreePine',
    seoTitle: 'Commercial Landscaping Contractors | XIRI Partners',
    seoDescription: 'Licensed landscaping contractors for commercial properties. Lawn care, tree service, irrigation, and seasonal maintenance. XIRI-verified.',
    definitionBlock: 'XIRI\'s landscaping partners provide commercial lawn maintenance, tree and shrub care, irrigation management, and seasonal cleanups for office parks, medical campuses, and retail properties across the NY metro area.',
  },
  {
    value: 'snow_removal', label: 'Snow & Ice Removal', slug: 'snow-ice-removal',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Snowflake',
    seoTitle: 'Commercial Snow Removal Contractors | XIRI Partners',
    seoDescription: 'Reliable commercial snow and ice removal contractors with 24/7 response. Plowing, salting, de-icing. XIRI-verified and insured.',
    definitionBlock: 'XIRI\'s snow removal partners provide 24/7 commercial plowing, salting, and de-icing services for parking lots, sidewalks, and building entries. All contractors carry dedicated snow removal insurance and GPS-tracked equipment.',
  },
  {
    value: 'pest_control', label: 'Pest Control', slug: 'pest-control',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Bug',
    seoTitle: 'Commercial Pest Control Contractors | XIRI Partners',
    seoDescription: 'NYSDEC-licensed pest control contractors for commercial buildings. Integrated pest management, rodent exclusion, and bed bug treatment.',
    definitionBlock: 'XIRI\'s pest control partners are NYSDEC-licensed applicators providing integrated pest management, rodent exclusion, and targeted treatments for commercial offices, restaurants, medical facilities, and multi-tenant buildings.',
  },
  {
    value: 'waste_management', label: 'Waste Management', slug: 'waste-management',
    group: 'facility', groupLabel: 'Facility & Maintenance',
    icon: 'Trash2',
    seoTitle: 'Commercial Waste Management Services | XIRI Partners',
    seoDescription: 'Vetted commercial waste and recycling contractors. Dumpster service, compactor maintenance, and waste audits. XIRI-verified.',
    definitionBlock: 'XIRI\'s waste management partners handle commercial dumpster service, compactor maintenance, recycling programs, and waste audits for office buildings, retail centers, and industrial facilities across the NY metro area.',
  },

  // ── Specialty ──
  {
    value: 'painting', label: 'Painting', slug: 'painting',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'Paintbrush',
    seoTitle: 'Commercial Painting Contractors | XIRI Partners',
    seoDescription: 'Licensed commercial painting contractors for offices, retail, and industrial facilities. Interior, exterior, and specialty coatings. XIRI-verified.',
    definitionBlock: 'XIRI\'s painting partners deliver commercial interior and exterior painting, specialty coatings, and surface preparation for offices, retail spaces, and industrial facilities. All contractors carry OSHA certifications and lead-safe credentials.',
  },
  {
    value: 'roofing', label: 'Roofing', slug: 'roofing',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'Home',
    seoTitle: 'Commercial Roofing Contractors | XIRI Partners',
    seoDescription: 'Licensed commercial roofing contractors for flat roof repair, membrane installation, and maintenance. XIRI-verified and insured.',
    definitionBlock: 'XIRI\'s roofing partners specialize in commercial flat roof systems including TPO, EPDM, and modified bitumen. Services include leak repair, membrane installation, and preventive maintenance programs.',
  },
  {
    value: 'locksmith', label: 'Locksmith', slug: 'locksmith',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'Lock',
    seoTitle: 'Commercial Locksmith Services | XIRI Partners',
    seoDescription: 'Licensed commercial locksmiths for access control, rekeying, master key systems, and emergency lockout service. XIRI-verified.',
    definitionBlock: 'XIRI\'s locksmith partners provide commercial access control installation, master key systems, rekeying, and 24/7 emergency lockout service for offices, medical facilities, and retail properties.',
  },
  {
    value: 'elevator', label: 'Elevator Maintenance', slug: 'elevator-maintenance',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'ArrowUpDown',
    seoTitle: 'Elevator Maintenance Contractors | XIRI Partners',
    seoDescription: 'QEI-certified elevator maintenance contractors for inspections, modernization, and emergency repair. XIRI-verified.',
    definitionBlock: 'XIRI\'s elevator partners are QEI-certified technicians providing code-mandated inspections, preventive maintenance, modernization, and 24/7 emergency repair for commercial passenger and freight elevators.',
  },
  {
    value: 'fire_safety', label: 'Fire Safety / Extinguishers', slug: 'fire-safety',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'Flame',
    seoTitle: 'Fire Safety & Extinguisher Services | XIRI Partners',
    seoDescription: 'NYC CoF-certified fire safety contractors for extinguisher inspection, sprinkler testing, and fire alarm maintenance. XIRI-verified.',
    definitionBlock: 'XIRI\'s fire safety partners hold NYC Certificates of Fitness and provide fire extinguisher inspection, sprinkler system testing, fire alarm maintenance, and code compliance consulting for commercial buildings.',
  },
  {
    value: 'medical_cleaning', label: 'Medical Facility Cleaning', slug: 'medical-facility-cleaning',
    group: 'specialty', groupLabel: 'Specialty Trades',
    icon: 'Stethoscope',
    seoTitle: 'Medical Facility Cleaning Contractors | XIRI Partners',
    seoDescription: 'HIPAA-trained medical cleaning contractors with GBAC STAR accreditation. OSHA-compliant terminal cleaning for healthcare facilities.',
    definitionBlock: 'XIRI\'s medical cleaning partners are HIPAA-trained, GBAC STAR-accredited contractors specializing in terminal cleaning, biohazard remediation, and infection control protocols for hospitals, clinics, surgery centers, and dental offices.',
  },
];

/** Lookup map: capability value → CapabilityMeta */
export const CAPABILITY_MAP = new Map(CAPABILITY_DIRECTORY.map(c => [c.value, c]));

/** Lookup map: slug → CapabilityMeta */
export const CAPABILITY_SLUG_MAP = new Map(CAPABILITY_DIRECTORY.map(c => [c.slug, c]));

/** Get capability groups for the directory home page */
export function getCapabilityGroups() {
  const groups: Record<string, CapabilityMeta[]> = {};
  for (const cap of CAPABILITY_DIRECTORY) {
    if (!groups[cap.group]) groups[cap.group] = [];
    groups[cap.group].push(cap);
  }
  return groups;
}

// ─── Capability Normalization ────────────────────────────────────
// Some vendors store capabilities as display labels ("Janitorial")
// instead of slugs ("janitorial"). Normalize at read-time.
const CAPABILITY_NORMALIZE_MAP: Record<string, string> = {};
for (const cap of CAPABILITY_DIRECTORY) {
  // Map label → value (case-insensitive)
  CAPABILITY_NORMALIZE_MAP[cap.label.toLowerCase()] = cap.value;
  CAPABILITY_NORMALIZE_MAP[cap.value] = cap.value;
}
// Common aliases not covered by label matching
Object.assign(CAPABILITY_NORMALIZE_MAP, {
  'cleaning': 'commercial_cleaning',
  'deep cleaning': 'commercial_cleaning',
  'sanitization': 'disinfecting',
  'restroom sanitation': 'janitorial',
  'trash removal': 'janitorial',
});

/** Normalize a single capability string to its slug value */
function normalizeCap(raw: string): string | undefined {
  const key = raw.toLowerCase().trim();
  return CAPABILITY_NORMALIZE_MAP[key];
}

/** Normalize an entire capabilities array, deduplicating */
function normalizeCapabilities(capabilities: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cap of capabilities) {
    const normalized = normalizeCap(cap);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

// ─── Slug Helpers ────────────────────────────────────────────────

/** Deterministic slug from business name */
export function vendorToSlug(businessName: string): string {
  if (!businessName) return 'unknown';
  return businessName
    .toLowerCase()
    .replace(/['']/g, '')            // Remove apostrophes
    .replace(/&/g, 'and')            // & → and
    .replace(/[^a-z0-9]+/g, '-')     // Non-alphanumeric → hyphen
    .replace(/(^-|-$)/g, '');        // Trim leading/trailing hyphens
}

/** Type for vendor data used on partner pages */
export interface PartnerVendor {
  id: string;
  slug: string;
  businessName: string;
  city: string;
  state: string;
  zip?: string;
  county?: string;
  serviceCounties?: string[];
  status: string;
  capabilities: string[];
  website?: string;
  googleRating?: number;
  googleRatingCount?: number;
  photoUrls?: string[];
  certifications?: string[];
  hasGeneralLiability?: boolean;
  hasWorkersComp?: boolean;
  hasBackgroundCheck?: boolean;
  description?: string;
  websiteScreenshotUrl?: string;
  partnerSince?: string; // ISO date string from statusUpdatedAt
}

/** Derive county name from zip code using the tax-rate lookup */
function countyFromZip(zip?: string): string | undefined {
  if (!zip) return undefined;
  const rate = getTaxRate(zip);
  return rate?.county || undefined;
}

/** Map raw Firestore vendor doc → PartnerVendor (safe for client) */
export function vendorToPartner(vendor: Vendor & { id: string }): PartnerVendor {
  // serviceCounties lives in onboarding (dynamic keys)
  const serviceCounties: string[] | undefined =
    (vendor as any).onboarding?.serviceCounties ||
    (vendor as any).serviceCounties ||
    (vendor as any).coverageAreas ||
    undefined;

  return {
    id: vendor.id,
    slug: vendorToSlug(vendor.businessName),
    businessName: vendor.businessName,
    city: vendor.city || '',
    state: vendor.state || 'NY',
    zip: vendor.zip,
    county: countyFromZip(vendor.zip),
    serviceCounties: serviceCounties?.length ? serviceCounties : undefined,
    status: vendor.status,
    capabilities: normalizeCapabilities(vendor.capabilities || []),
    website: vendor.website,
    googleRating: vendor.googlePlaces?.rating,
    googleRatingCount: vendor.googlePlaces?.ratingCount,
    photoUrls: vendor.googlePlaces?.photoUrls,
    certifications: (vendor as any).certifications,
    hasGeneralLiability: vendor.compliance?.generalLiability?.hasInsurance,
    hasWorkersComp: vendor.compliance?.workersComp?.hasInsurance,
    hasBackgroundCheck: vendor.compliance?.backgroundCheck,
    description: vendor.description,
    websiteScreenshotUrl: vendor.websiteScreenshotUrl,
    partnerSince: (vendor as any).statusUpdatedAt?.toDate?.() 
      ? (vendor as any).statusUpdatedAt.toDate().toISOString()
      : (vendor as any).statusUpdatedAt || undefined,
  };
}

// ─── Firestore Queries ───────────────────────────────────────────

/** Fetch all publishable vendors (active + ready_for_assignment) */
export async function getPublishableVendors(): Promise<PartnerVendor[]> {
  const vendorsRef = collection(db, 'vendors');
  const q = query(vendorsRef, where('status', 'in', [...PUBLISHABLE_STATUSES]));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc =>
    vendorToPartner({ id: doc.id, ...doc.data() } as Vendor & { id: string })
  );
}

/** Fetch a single vendor by slug (checks all statuses) */
export async function getVendorBySlug(slug: string): Promise<PartnerVendor | null> {
  // We need to fetch all vendors and match by slug since Firestore
  // doesn't support querying on a derived field
  const vendorsRef = collection(db, 'vendors');
  const snapshot = await getDocs(vendorsRef);

  for (const doc of snapshot.docs) {
    const vendor = { id: doc.id, ...doc.data() } as Vendor & { id: string };
    if (vendorToSlug(vendor.businessName) === slug) {
      return vendorToPartner(vendor);
    }
  }
  return null;
}

/**
 * Fetch vendors by capability value.
 * Queries by status then filters client-side with normalization,
 * because Firestore array-contains can't handle label vs slug mismatches.
 */
export async function getVendorsByCapability(capabilityValue: string): Promise<PartnerVendor[]> {
  const vendorsRef = collection(db, 'vendors');
  const q = query(
    vendorsRef,
    where('status', 'in', [...PUBLISHABLE_STATUSES]),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .filter(doc => {
      const vendor = doc.data();
      if (!vendor.businessName) return false; // skip phantom docs
      const caps = normalizeCapabilities(vendor.capabilities || []);
      return caps.includes(capabilityValue);
    })
    .map(doc =>
      vendorToPartner({ id: doc.id, ...doc.data() } as Vendor & { id: string })
    );
}

// ─── SEO Helpers ─────────────────────────────────────────────────

/** Generate JSON-LD for a single vendor (LocalBusiness) */
export function vendorJsonLd(vendor: PartnerVendor) {
  const capabilities = vendor.capabilities
    .map(c => CAPABILITY_MAP.get(c)?.label)
    .filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: vendor.businessName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: vendor.city,
      addressRegion: vendor.state,
    },
    ...(vendor.googleRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: vendor.googleRating,
        reviewCount: vendor.googleRatingCount || 0,
      },
    }),
    makesOffer: capabilities.map(cap => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: cap,
        provider: { '@type': 'Organization', name: 'XIRI Facility Solutions' },
      },
    })),
  };
}

/** Generate JSON-LD for a capability listing page (ItemList) */
export function capabilityListJsonLd(capability: CapabilityMeta, vendors: PartnerVendor[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${capability.label} Contractors — XIRI Partner Network`,
    description: capability.seoDescription,
    numberOfItems: vendors.length,
    itemListElement: vendors.slice(0, 10).map((vendor, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: vendor.businessName,
        address: {
          '@type': 'PostalAddress',
          addressLocality: vendor.city,
          addressRegion: vendor.state,
        },
        url: `https://xiri.ai/partners/profile/${vendor.slug}`,
      },
    })),
  };
}

/** Generate BreadcrumbList JSON-LD */
export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
