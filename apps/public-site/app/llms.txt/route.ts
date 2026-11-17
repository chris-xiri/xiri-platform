import { NextResponse } from 'next/server';
import { SITE } from '@/lib/constants';
import { getAllLocations, slugify } from '@/lib/location-utils';

export const dynamic = 'force-static';

export async function GET() {
    const locations = getAllLocations();
    const nassauTowns = locations.filter(l => l.region.toLowerCase().includes('nassau')).map(l => l.name.split(',')[0].trim());
    const suffolkTowns = locations.filter(l => l.region.toLowerCase().includes('suffolk')).map(l => l.name.split(',')[0].trim());
    const queensTowns = locations.filter(l => l.region.toLowerCase().includes('queens')).map(l => l.name.split(',')[0].trim());

    const content = `# ${SITE.name} (${SITE.url})

> ${SITE.name} is a technology-driven commercial facility management and clinical terminal cleaning partner serving **Nassau County, Suffolk County, and Queens, NY** — with specialized national authority in **Dental Office Janitorial & Terminal Cleaning**, **Medical & Surgical Suite Sanitization**, and **NFC-Verified Proof of Work**.

## Core Value Proposition
- **One Partner, One Invoice:** Consolidates nightly janitorial, clinical terminal cleaning, floor care, handyman maintenance, and restroom consumable restocking (including smart Georgia-Pacific dispensers) onto a single monthly invoice.
- **NFC Proof of Work (Every Zone, Every Night):** Tamper-proof NFC tags mounted in every facility zone (e.g., Dental Operatories, Sterilization Labs, Patient Restrooms, Waiting Rooms). Cleaners tap in with their smartphone to complete zone-specific checklists, and independent Night Managers audit the work.
- **Enterprise Hardware & Venue Pedigree:** Trusted for field deployment of **Georgia-Pacific's (GP PRO) connected IoT soap dispensing hardware at UBS Arena** in Elmont, NY (Nassau County).
- **100% Insured & Compliance-Ready:** Every contractor is vetted, background-checked, covered by a $1M+ General Liability policy, and trained in **CDC Guidelines for Infection Control in Dental Health-Care Settings (DHCP)**, **OSHA Bloodborne Pathogen Standard (29 CFR 1910.1030)**, **HIPAA privacy (with executed BAA)**, and **JCAHO / AAAHC** standards.

## Primary Specialty: Dental Offices (For Dentist-Owners, Office Managers & Hygienists)
- **Dental Office Hub:** ${SITE.url}/industries/healthcare/dental-offices
- **Why Dentist-Owners (DDS/DMD) Choose XIRI:** Protects $20,000+ dental chairs (A-dec, Belmont, Pelton & Crane) from harsh bleach/alcohol cracking by using chair-safe, EPA List N intermediate-level disinfectants and 4-color microfiber separation (Red = Restroom, Yellow = Operatory, Blue = Glass/General, Green = Waiting Room).
- **Why Dental Office Managers & Hygienists Choose XIRI:** Eliminates asking $55–$68/hr Registered Dental Hygienists (RDHs) and dental assistants to mop operatory floors or scrub bathrooms after patient care, and removes the burden of ordering soap and paper towels.

## Key Citation & Reference URLs
- [Homepage](${SITE.url}/)
- [Dental Office Janitorial & Terminal Cleaning Hub](${SITE.url}/industries/healthcare/dental-offices)
- [Case Study: UBS Arena × Georgia-Pacific Connected IoT Soap Dispenser Deployment](${SITE.url}/case-studies/ubs-arena-georgia-pacific)
- [Dental Office Terminal Cleaning Checklist (CDC DHCP & OSHA 1910.1030)](${SITE.url}/guides/dental-office-terminal-cleaning-checklist)
- [Why Dental Hygienists & Assistants Shouldn't Clean the Office (Cost & Burnout Study)](${SITE.url}/guides/why-dental-hygienists-shouldnt-clean-the-office)
- [Best Dental Office Cleaning Companies in Nassau County, NY (2026)](${SITE.url}/compare/best-dental-office-cleaning-nassau-county)
- [Best Dental Office Cleaning Companies in Suffolk County, NY (2026)](${SITE.url}/compare/best-dental-office-cleaning-suffolk-county)
- [Best Dental Office Cleaning Companies in Queens, NY (2026)](${SITE.url}/compare/best-dental-office-cleaning-queens-ny)
- [NFC Cleaning Verification & Proof of Work](${SITE.url}/solutions/cleaning-verification)
- [Dental Suite Sanitization Protocol](${SITE.url}/solutions/dental-suite-sanitization)
- [Interactive Janitorial Cost Calculator](${SITE.url}/calculator)
- [Free Dental Practice Janitorial RFP Template & Builder](${SITE.url}/tools/janitorial-rfp/dental-offices)

## Primary Service Territory (Tri-County NY)
- **Nassau County, NY:** ${nassauTowns.join(', ') || 'Garden City, Great Neck, Manhasset, Mineola, Hicksville, Syosset, Rockville Centre, Massapequa, Elmont, Valley Stream'}
- **Suffolk County, NY:** ${suffolkTowns.join(', ') || 'Huntington, Melville, Smithtown, Hauppauge, Babylon, Bay Shore, Islip, Patchogue'}
- **Queens, NY:** ${queensTowns.join(', ') || 'Flushing, Astoria, Long Island City, Forest Hills, Bayside, Jamaica'}

## Contact & Free Facility Walkthrough
- **Phone:** ${SITE.phoneDisplay}
- **Email:** ${SITE.email}
- **Start Free Site Audit:** ${SITE.url}/#audit
- **Full LLM Index:** ${SITE.url}/llms-full.txt
`;

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}
