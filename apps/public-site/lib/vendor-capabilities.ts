/**
 * Vendor Capabilities (Public Site)
 *
 * Re-exports from the dashboard's vendor-capabilities module.
 * Used by the partner directory pages for certification lookups
 * and county labels.
 *
 * NOTE: This is a subset copy. The canonical source is
 * apps/dashboard/src/lib/vendor-capabilities.ts
 */

export interface CertificationOption {
  value: string;
  label: string;
  capabilities: string[];
}

export const CERTIFICATIONS: CertificationOption[] = [
  // Plumbing
  { value: 'nys_lmp', label: 'NYS Licensed Master Plumber', capabilities: ['plumbing'] },
  { value: 'nyc_lmp', label: 'NYC Licensed Master Plumber', capabilities: ['plumbing'] },
  { value: 'nys_backflow_tester', label: 'NYS Backflow Prevention Tester', capabilities: ['plumbing'] },
  { value: 'nyc_fire_suppression', label: 'NYC Fire Suppression Piping License', capabilities: ['plumbing'] },
  // HVAC
  { value: 'epa_608', label: 'EPA Section 608 Certification', capabilities: ['hvac'] },
  { value: 'epa_608_universal', label: 'EPA 608 Universal', capabilities: ['hvac'] },
  { value: 'nate_certified', label: 'NATE Certified Technician', capabilities: ['hvac'] },
  { value: 'nyc_refrig_op', label: 'NYC Refrigerating System Operator', capabilities: ['hvac'] },
  // Electrical
  { value: 'nyc_electrician_license', label: 'NYC Electrician License', capabilities: ['electrical'] },
  { value: 'nys_electrician_license', label: 'NYS Electrician License', capabilities: ['electrical'] },
  { value: 'osha_10', label: 'OSHA 10-Hour Construction', capabilities: ['electrical', 'plumbing', 'hvac', 'roofing', 'painting', 'elevator'] },
  { value: 'osha_30', label: 'OSHA 30-Hour Construction', capabilities: ['electrical', 'plumbing', 'hvac', 'roofing', 'painting', 'elevator'] },
  // Fire Safety
  { value: 'nyc_fire_guard', label: 'NYC Certificate of Fitness (Fire Guard)', capabilities: ['fire_safety'] },
  { value: 'nyc_cof_s12', label: 'NYC CoF S-12 (Sprinkler)', capabilities: ['fire_safety', 'plumbing'] },
  { value: 'nyc_cof_s13', label: 'NYC CoF S-13 (Standpipe)', capabilities: ['fire_safety', 'plumbing'] },
  { value: 'nys_fire_extinguisher', label: 'NYS Fire Extinguisher Technician', capabilities: ['fire_safety'] },
  // Elevator
  { value: 'nyc_elevator_agency', label: 'NYC Elevator Agency Director License', capabilities: ['elevator'] },
  { value: 'qei_certified', label: 'QEI Certified Elevator Inspector', capabilities: ['elevator'] },
  // Pest Control
  { value: 'nysdec_pest_applicator', label: 'NYSDEC Pesticide Applicator License', capabilities: ['pest_control'] },
  { value: 'nysdec_pest_tech', label: 'NYSDEC Commercial Pest Technician', capabilities: ['pest_control'] },
  // General / Cleaning
  { value: 'issa_cims', label: 'ISSA CIMS Certification', capabilities: ['janitorial', 'commercial_cleaning'] },
  { value: 'gbac_star', label: 'GBAC STAR Accreditation', capabilities: ['janitorial', 'commercial_cleaning', 'disinfecting', 'medical_cleaning'] },
  { value: 'iicrc_certified', label: 'IICRC Certified Technician', capabilities: ['carpet_upholstery', 'floor_care'] },
  // Landscaping
  { value: 'nys_pesticide_applicator', label: 'NYS Pesticide Applicator (Landscaping)', capabilities: ['landscaping'] },
  { value: 'nys_arborist', label: 'ISA Certified Arborist', capabilities: ['landscaping'] },
  // General
  { value: 'general_liability_ins', label: 'General Liability Insurance ($1M+)', capabilities: [] },
  { value: 'workers_comp', label: "Workers' Compensation Certificate", capabilities: [] },
];

export interface ServiceCounty {
  value: string;
  label: string;
  region: 'nyc' | 'long_island' | 'hudson_valley' | 'nj';
}

export const SERVICE_COUNTIES: ServiceCounty[] = [
  { value: 'new_york', label: 'Manhattan (New York County)', region: 'nyc' },
  { value: 'kings', label: 'Brooklyn (Kings County)', region: 'nyc' },
  { value: 'queens', label: 'Queens (Queens County)', region: 'nyc' },
  { value: 'bronx', label: 'Bronx (Bronx County)', region: 'nyc' },
  { value: 'richmond', label: 'Staten Island (Richmond Co.)', region: 'nyc' },
  { value: 'nassau', label: 'Nassau County', region: 'long_island' },
  { value: 'suffolk', label: 'Suffolk County', region: 'long_island' },
  { value: 'westchester', label: 'Westchester County', region: 'hudson_valley' },
  { value: 'rockland', label: 'Rockland County', region: 'hudson_valley' },
  { value: 'orange', label: 'Orange County', region: 'hudson_valley' },
  { value: 'dutchess', label: 'Dutchess County', region: 'hudson_valley' },
  { value: 'bergen', label: 'Bergen County, NJ', region: 'nj' },
  { value: 'hudson', label: 'Hudson County, NJ', region: 'nj' },
  { value: 'essex', label: 'Essex County, NJ', region: 'nj' },
  { value: 'passaic', label: 'Passaic County, NJ', region: 'nj' },
];

export const COUNTY_REGION_LABELS: Record<ServiceCounty['region'], string> = {
  nyc: 'New York City',
  long_island: 'Long Island',
  hudson_valley: 'Hudson Valley',
  nj: 'Northern New Jersey',
};
