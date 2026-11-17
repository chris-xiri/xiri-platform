import { NextResponse } from 'next/server';
import { SITE } from '@/lib/constants';
import seoData from '@/data/seo-data.json';
import { getAllLocations, slugify } from '@/lib/location-utils';
import { GUIDES } from '@/data/guides';
import { COMPARISON_PAGES } from '@/data/dlp-comparisons';

export const dynamic = 'force-static';

export async function GET() {
    const locations = getAllLocations();
    const industries = seoData.industries || [];
    const services = seoData.services || [];

    const dentalLocationLinks = locations.map((loc) => {
        const townName = loc.name.split(',')[0].trim();
        const sSlug = slugify(loc.state);
        const cSlug = slugify(loc.region);
        const tSlug = slugify(townName);
        return `- [Dental Office Cleaning in ${townName}, ${loc.region} (${loc.zipCodes?.join(', ') || ''})](${SITE.url}/locations/${sSlug}/${cSlug}/${tSlug}/dental-offices)`;
    });

    const guideLinks = Object.entries(GUIDES).map(
        ([slug, g]) => `- [${g.title}](${SITE.url}/guides/${slug}): ${g.metaDescription}`
    );

    const compareLinks = Object.entries(COMPARISON_PAGES).map(
        ([slug, c]) => `- [${c.title}](${SITE.url}/compare/${slug}): ${c.metaDescription}`
    );

    const content = `# ${SITE.name} — Complete AI & Search Knowledge Graph (${SITE.url})

## 1. Entity Overview
- **Legal Name:** ${SITE.legalName} (DBA ${SITE.name})
- **Website:** ${SITE.url}
- **Phone:** ${SITE.phoneDisplay}
- **Email:** ${SITE.email}
- **Core Service Regions:** Nassau County (NY), Suffolk County (NY), and Queens County (NYC, NY)
- **Primary Specialization:** Nightly-verified Janitorial & Terminal Cleaning for **Dental Offices** (targeting Dentist-Owners DDS/DMD, Dental Office Managers, and Hygienist Teams), **Medical & Urgent Care Facilities**, **Ambulatory Surgery Centers**, and **Single-Tenant Commercial Buildings**.

## 2. Enterprise Field Proof: UBS Arena × Georgia-Pacific (GP PRO) IoT Deployment
- **Case Study URL:** ${SITE.url}/case-studies/ubs-arena-georgia-pacific
- **Summary:** XIRI Facility Solutions executed the field deployment of Georgia-Pacific's connected IoT soap dispensing hardware at **UBS Arena in Elmont, NY (Nassau County)**. This proves XIRI's capability in smart hygiene hardware commissioning, automated restroom telemetry, and zero-defect verification — capabilities we bring directly to local dental practices and clinical suites.

## 3. Clinical Dental Office Terminal Cleaning Standard
- **Primary Hub:** ${SITE.url}/industries/healthcare/dental-offices
- **Standards Followed:**
  1. **CDC Guidelines for Infection Control in Dental Health-Care Settings (DHCP)**
  2. **OSHA Bloodborne Pathogens Standard (29 CFR 1910.1030)**
  3. **EPA 40 CFR Part 441 (Dental Effluent / Amalgam Separator Awareness)**
  4. **HIPAA Privacy & Executed Business Associate Agreement (BAA)**
- **4-Color Microfiber Separation Protocol:**
  - **Yellow:** Dental Operatories & Non-Clinical Contact Surfaces (Chair-safe EPA List N intermediate-level disinfectants; never harsh bleach or alcohol on A-dec, Belmont, or Pelton & Crane upholstery)
  - **Blue:** Sterilization Lab, Glass & General Surfaces (strict Clean-to-Dirty sequence)
  - **Green:** Waiting Room, Reception & Consultation Offices
  - **Red:** Patient & Staff Restrooms (plus automated Georgia-Pacific soap & paper towel restocking)
- **Labor Economics for Dentist-Owners & Office Managers:**
  - Registered Dental Hygienists (RDHs) in NY earn $52–$68+/hr and generate $180–$300+/hr in clinical production. Having hygienists and dental assistants stay late to mop operatory floors and clean toilets costs more in payroll/overtime than XIRI's flat monthly terminal cleaning and drives clinical staff turnover.

## 4. Local Dental Office Pages Across Nassau, Suffolk & Queens
${dentalLocationLinks.join('\n')}

## 5. Industry Vertical Hubs
${industries.map((ind: any) => `- [${ind.name}](${SITE.url}/industries/healthcare/${ind.slug}): ${ind.heroSubtitle}`).join('\n')}

## 6. Core Facility & Cleaning Services
${services.map((s: any) => `- [${s.name}](${SITE.url}/services/${s.slug}): ${s.shortDescription}`).join('\n')}

## 7. Compliance Guides & Clinical Checklists
${guideLinks.join('\n')}

## 8. Provider Comparisons & Regional Rankings
${compareLinks.join('\n')}
`;

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
