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

  // ── Facility / Maintenance ──
  { value: 'hvac',                 label: 'HVAC Maintenance',       group: 'facility' },
  { value: 'plumbing',             label: 'Plumbing',               group: 'facility' },
  { value: 'electrical',           label: 'Electrical',             group: 'facility' },
  { value: 'handyman',             label: 'Handyman Services',      group: 'facility' },
  { value: 'landscaping',          label: 'Landscaping',            group: 'facility' },
  { value: 'snow_removal',         label: 'Snow & Ice Removal',     group: 'facility' },
  { value: 'pest_control',         label: 'Pest Control',           group: 'facility' },
  { value: 'waste_management',     label: 'Waste Management',       group: 'facility' },

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
