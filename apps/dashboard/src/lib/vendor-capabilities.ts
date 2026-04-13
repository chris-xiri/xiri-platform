/**
 * Predefined list of vendor capabilities / trade specialties.
 * Used across the CRM to ensure data integrity — no free-text entry.
 *
 * Aligned with:
 *  - TradeType from @xiri-facility-solutions/shared
 *  - SERVICE_GROUPS from the public site
 */

export interface CapabilityOption {
  value: string;
  label: string;
  group: 'cleaning' | 'facility' | 'specialty';
}

export const VENDOR_CAPABILITIES: CapabilityOption[] = [
  // ── Cleaning ──
  { value: 'janitorial',           label: 'Janitorial Services',    group: 'cleaning' },
  { value: 'commercial_cleaning',  label: 'Commercial Cleaning',    group: 'cleaning' },
  { value: 'floor_care',           label: 'Floor Care',             group: 'cleaning' },
  { value: 'carpet_upholstery',    label: 'Carpet & Upholstery',   group: 'cleaning' },
  { value: 'window_cleaning',      label: 'Window Cleaning',        group: 'cleaning' },
  { value: 'pressure_washing',     label: 'Pressure Washing',       group: 'cleaning' },
  { value: 'disinfecting',         label: 'Disinfecting Services',  group: 'cleaning' },
  { value: 'day_porter',           label: 'Day Porters',            group: 'cleaning' },
  { value: 'post_construction',    label: 'Post-Construction Cleaning', group: 'cleaning' },

  // ── Facility / Maintenance ──
  { value: 'hvac',                 label: 'HVAC Maintenance',       group: 'facility' },
  { value: 'plumbing',             label: 'Plumbing',               group: 'facility' },
  { value: 'electrical',           label: 'Electrical',             group: 'facility' },
  { value: 'handyman',             label: 'Handyman Services',      group: 'facility' },
  { value: 'landscaping',          label: 'Landscaping',            group: 'facility' },
  { value: 'snow_removal',         label: 'Snow & Ice Removal',     group: 'facility' },
  { value: 'pest_control',         label: 'Pest Control',           group: 'facility' },
  { value: 'waste_management',     label: 'Waste Management',       group: 'facility' },
  { value: 'interior_plant_maintenance', label: 'Interior Plant Maintenance', group: 'facility' },

  // ── Specialty ──
  { value: 'painting',             label: 'Painting',               group: 'specialty' },
  { value: 'roofing',              label: 'Roofing',                group: 'specialty' },
  { value: 'locksmith',            label: 'Locksmith',              group: 'specialty' },
  { value: 'elevator',             label: 'Elevator Maintenance',   group: 'specialty' },
  { value: 'fire_safety',          label: 'Fire Safety / Extinguishers', group: 'specialty' },
  { value: 'medical_cleaning',     label: 'Medical Facility Cleaning', group: 'specialty' },
];

/** Group labels for display */
export const CAPABILITY_GROUP_LABELS: Record<CapabilityOption['group'], string> = {
  cleaning:  'Cleaning',
  facility:  'Facility & Maintenance',
  specialty: 'Specialty Trades',
};

/** Lookup map for fast label resolution */
const CAPABILITY_MAP = new Map(VENDOR_CAPABILITIES.map(c => [c.value, c]));

/** Get the display label for a capability value string */
export function getCapabilityLabel(value: string): string {
  const normalized = normalizeCapability(value);
  return CAPABILITY_MAP.get(normalized)?.label ?? value;
}

/**
 * Map of common free-text variants → standardized value.
 * Handles legacy data from before we had validated input.
 */
const NORMALIZE_MAP: Record<string, string> = {
  // Cleaning
  'janitorial services':    'janitorial',
  'janitorial':             'janitorial',
  'commercial cleaning':    'commercial_cleaning',
  'commercial-cleaning':    'commercial_cleaning',
  'floor care':             'floor_care',
  'floor-care':             'floor_care',
  'carpet & upholstery':    'carpet_upholstery',
  'carpet and upholstery':  'carpet_upholstery',
  'carpet-upholstery':      'carpet_upholstery',
  'carpet':                 'carpet_upholstery',
  'window cleaning':        'window_cleaning',
  'window-cleaning':        'window_cleaning',
  'pressure washing':       'pressure_washing',
  'pressure-washing':       'pressure_washing',
  'disinfecting':           'disinfecting',
  'disinfecting services':  'disinfecting',
  'disinfecting-services':  'disinfecting',
  'day porter':             'day_porter',
  'day porters':            'day_porter',
  'day-porter':             'day_porter',
  // Post-Construction
  'post-construction':      'post_construction',
  'post construction':      'post_construction',
  'post construction cleaning': 'post_construction',
  'post-construction cleaning': 'post_construction',
  'construction cleanup':   'post_construction',
  // Facility
  'hvac':                   'hvac',
  'hvac maintenance':       'hvac',
  'hvac-maintenance':       'hvac',
  'plumbing':               'plumbing',
  'electrical':             'electrical',
  'handyman':               'handyman',
  'handyman services':      'handyman',
  'handyman-services':      'handyman',
  'landscaping':            'landscaping',
  'snow removal':           'snow_removal',
  'snow & ice removal':     'snow_removal',
  'snow-ice-removal':       'snow_removal',
  'snow_removal':           'snow_removal',
  'pest control':           'pest_control',
  'pest-control':           'pest_control',
  'waste management':       'waste_management',
  'waste-management':       'waste_management',
  // Interior Plant Maintenance
  'indoor plant watering':          'indoor_plant_watering',
  'indoor-plant-watering':          'indoor_plant_watering',
  'plant watering':                 'indoor_plant_watering',
  'plant care':                     'indoor_plant_watering',
  'interior plant maintenance':     'indoor_plant_watering',
  'plant maintenance':              'indoor_plant_watering',
  // Specialty
  'painting':               'painting',
  'roofing':                'roofing',
  'locksmith':              'locksmith',
  'elevator':               'elevator',
  'elevator maintenance':   'elevator',
  'fire safety':            'fire_safety',
  'fire_safety':            'fire_safety',
  'medical cleaning':       'medical_cleaning',
  'medical facility cleaning': 'medical_cleaning',
  'medical':                'medical_cleaning',
};

/**
 * Normalize a capability string to its standardized value.
 * If not found in the map, returns the original string unchanged.
 */
export function normalizeCapability(value: string): string {
  if (!value) return value;
  // If it's already a known standard value, return as-is
  if (CAPABILITY_MAP.has(value)) return value;
  // Try case-insensitive lookup
  return NORMALIZE_MAP[value.toLowerCase().trim()] ?? value;
}

/**
 * Normalize an entire capabilities array, deduplicating in the process.
 */
export function normalizeCapabilities(capabilities: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cap of capabilities) {
    const normalized = normalizeCapability(cap);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/* ─── Service Counties ─────────────────────────────────────────────── */

export interface ServiceCounty {
  value: string;
  label: string;
  region: 'nyc' | 'long_island' | 'hudson_valley' | 'nj';
}

export const SERVICE_COUNTIES: ServiceCounty[] = [
  // NYC Boroughs
  { value: 'new_york',      label: 'Manhattan (New York County)',   region: 'nyc' },
  { value: 'kings',         label: 'Brooklyn (Kings County)',       region: 'nyc' },
  { value: 'queens',        label: 'Queens (Queens County)',        region: 'nyc' },
  { value: 'bronx',         label: 'Bronx (Bronx County)',         region: 'nyc' },
  { value: 'richmond',      label: 'Staten Island (Richmond Co.)', region: 'nyc' },
  // Long Island
  { value: 'nassau',        label: 'Nassau County',                region: 'long_island' },
  { value: 'suffolk',       label: 'Suffolk County',               region: 'long_island' },
  // Hudson Valley / Suburbs
  { value: 'westchester',   label: 'Westchester County',           region: 'hudson_valley' },
  { value: 'rockland',      label: 'Rockland County',              region: 'hudson_valley' },
  { value: 'orange',        label: 'Orange County',                region: 'hudson_valley' },
  { value: 'dutchess',      label: 'Dutchess County',              region: 'hudson_valley' },
  // NJ (close metros)
  { value: 'bergen',        label: 'Bergen County, NJ',            region: 'nj' },
  { value: 'hudson',        label: 'Hudson County, NJ',            region: 'nj' },
  { value: 'essex',         label: 'Essex County, NJ',             region: 'nj' },
  { value: 'passaic',       label: 'Passaic County, NJ',           region: 'nj' },
];

export const COUNTY_REGION_LABELS: Record<ServiceCounty['region'], string> = {
  nyc:           'New York City',
  long_island:   'Long Island',
  hudson_valley: 'Hudson Valley',
  nj:            'Northern New Jersey',
};

/* ─── Certifications by Capability ─────────────────────────────────── */

export interface CertificationOption {
  value: string;
  label: string;
  /** Which capability values this cert is relevant to */
  capabilities: string[];
}

/**
 * NYS-relevant certifications mapped to vendor capabilities.
 * A cert appears in the picker only when the vendor has at least one matching capability.
 */
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
  { value: 'gbac_star',               label: 'GBAC STAR Accreditation',                   capabilities: ['janitorial', 'commercial_cleaning', 'disinfecting', 'medical_cleaning'] },
  { value: 'iicrc_certified',         label: 'IICRC Certified Technician',                capabilities: ['carpet_upholstery', 'floor_care'] },
  // Landscaping
  { value: 'nys_pesticide_applicator', label: 'NYS Pesticide Applicator (Landscaping)',    capabilities: ['landscaping'] },
  { value: 'nys_arborist',            label: 'ISA Certified Arborist',                    capabilities: ['landscaping'] },
  // General trade
  { value: 'general_liability_ins',    label: 'General Liability Insurance ($1M+)',         capabilities: [] }, // shown for all
  { value: 'workers_comp',            label: 'Workers\' Compensation Certificate',          capabilities: [] }, // shown for all
];

/**
 * Filter certifications to those relevant for the vendor's capabilities.
 * Certs with empty capabilities array are always included (general requirements).
 */
export function getCertificationsForCapabilities(capabilities: string[]): CertificationOption[] {
  const normalized = capabilities.map(normalizeCapability);
  return CERTIFICATIONS.filter(cert =>
    cert.capabilities.length === 0 || cert.capabilities.some(c => normalized.includes(c))
  );
}
