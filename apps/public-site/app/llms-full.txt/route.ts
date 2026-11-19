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

## 3. Clinical Dental Office Terminal Cleaning & 20-Asset Protection Standard
- **Primary Hub:** ${SITE.url}/industries/healthcare/dental-offices
- **20-Asset Equipment, LVT & Carpet Guide:** ${SITE.url}/guides/dental-office-equipment-flooring-care-guide
- **Standards Followed:**
  1. **CDC Guidelines for Infection Control in Dental Health-Care Settings (DHCP)**
  2. **OSHA Bloodborne Pathogens Standard (29 CFR 1910.1030)**
  3. **EPA 40 CFR Part 441 (Dental Effluent / Solmetex NXT Hg5 Amalgam Separator Safety)**
  4. **HIPAA Privacy & Executed Business Associate Agreement (BAA)**
- **Operatory Floor Scuffs, Sticky CaviWipe Film & Waiting Room Carpet Care:**
  - **Sticky LVT / Sheet Vinyl Fix:** Neutral-pH microfiber flat-pad rinse that removes cross-linked **CaviWipe / Optim 1 / Cavitron ultrasonic aerosol residue** from **Forbo Marmoleum, Tarkett, and Armstrong Medintech** clinical vinyl without dulling the wear layer.
  - **Saddle Stool Scuff Removal:** Clearing hair/debris from 5-caster wheels on **A-dec, Crown Seating, and Brewer saddle stools** and low-RPM buffing black rubber caster scuff rings.
  - **Waiting Room Carpet Traffic Lanes & Winter Salt:** Nightly **CRI Seal-of-Approval HEPA brush-roll agitation** to stop sand from cutting carpet pile, plus NY winter rock-salt neutralizer rinses and low-moisture encapsulation.
- **Hands-Off $150k+ Clinical Equipment Boundaries:**
  - Strict Hands-Off rule on **A-dec / Belmont / Midmark Ultraleather chair upholstery**, **iTero / CEREC Primescan / 3Shape Trios scanners**, **Planmeca / Carestream CBCT C-arms**, and **Midmark M11 / SciCan Statim autoclave sterile pouches**.
  - Hand-detailing around **floor junction boxes (J-boxes)**, **rheostat foot pedals**, **12-o'clock cabinet toe-kicks**, **wet/dry lab gypsum stone/alginate dust**, and the **"Supine Patient View"** (overhead track-light arms and ceiling HVAC vents).
- **Specialized Technical Solutions:**
  - **ESD-Safe Floor Care (ANSI/ESD S20.20 & STM7.1):** ${SITE.url}/solutions/esd-safe-floor-care — 5-lb electrode megohmmeter testing ($10^5$ to $10^9$ ohms) and ACL Staticide dissipative floor finishes.
  - **Smart IoT Restroom Dispenser Installation:** ${SITE.url}/solutions/iot-restroom-dispenser-installation — Georgia-Pacific (GP PRO KOLO / enMotion), Tork, Purell, and Bobrick multi-stall rollouts.

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
