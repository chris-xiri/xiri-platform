'use client';

import Link from 'next/link';

// ── Relationship Map ──
// Each category maps to a list of related DLP links.
// A page only sees links from its own category — never cross-pollinated.

const SIDEBAR_LINKS: Record<string, { label: string; href: string }[]> = {
    medical: [
        { label: 'JCAHO Survey-Ready Disinfection', href: '/solutions/jcaho-survey-ready-disinfection' },
        { label: 'Terminal Cleaning for Surgery Centers', href: '/solutions/terminal-cleaning-surgery-centers' },
        { label: 'Dental Suite Sanitization', href: '/solutions/dental-suite-sanitization' },
        { label: 'NPI-Verified Facility Governance', href: '/solutions/npi-verified-facility-governance' },
        { label: 'JCAHO Cleaning Requirements Guide', href: '/guides/jcaho-cleaning-requirements' },
        { label: 'Accreditation 360 Prep Guide', href: '/guides/accreditation-360-preparation-guide' },
    ],
    'life-sciences': [
        { label: 'ISO 7/8 Cleanroom Protocol', href: '/solutions/iso-7-8-cleanroom-protocol' },
        { label: 'cGMP Lab Decontamination', href: '/solutions/cgmp-lab-decontamination' },
        { label: 'BSL-2 Lab Waste Management', href: '/solutions/bsl-2-lab-waste-management' },
        { label: 'Labs & Cleanrooms', href: '/labs-cleanrooms' },
    ],
    industrial: [
        { label: 'Auto Shop Slip-Coefficient Logging', href: '/solutions/auto-shop-slip-coefficient-logging' },
        { label: 'Zinc-Whisker Remediation', href: '/solutions/data-center-zinc-whisker-remediation' },
        { label: 'ESD-Safe Floor Care', href: '/solutions/esd-safe-floor-care' },
        { label: 'Light Manufacturing', href: '/light-manufacturing' },
        { label: 'Auto Dealerships', href: '/auto-dealerships' },
    ],
    institutional: [
        { label: 'Bank Vault Micro-Climate Sanitization', href: '/solutions/bank-vault-micro-climate-sanitization' },
        { label: 'High-Security Cash Room Protocols', href: '/solutions/high-security-cash-room-protocols' },
    ],
    'contractor-trade': [
        { label: 'Janitorial Subcontractor', href: '/contractors/janitorial-subcontractor' },
        { label: 'HVAC Subcontractor', href: '/contractors/hvac-subcontractor' },
        { label: 'Landscaping Subcontractor', href: '/contractors/landscaping-subcontractor' },
        { label: 'Plumbing Subcontractor', href: '/contractors/plumbing-subcontractor' },
        { label: 'Electrical Subcontractor', href: '/contractors/electrical-subcontractor' },
        { label: 'Handyman Subcontractor', href: '/contractors/handyman-subcontractor' },
    ],
    'contractor-geo': [
        { label: 'Jobs in Great Neck', href: '/contractors/cleaning-jobs-in-great-neck-nassau-ny' },
        { label: 'Jobs in New Hyde Park', href: '/contractors/cleaning-jobs-in-new-hyde-park-nassau-ny' },
    ],
    'contractor-keyword': [
        { label: '1099 Subcontractor Opportunities', href: '/contractors/subcontractor-opportunities' },
        { label: 'Medical Cleaning Careers', href: '/contractors/medical-cleaning-careers' },
        { label: 'RFP & Bidding', href: '/contractors/facility-management-rfp' },
    ],
    'contractor-guide': [
        { label: 'How to Bid on Medical Contracts', href: '/contractors/how-to-bid-institutional-medical-contracts' },
        { label: 'XIRI Compliance Requirements', href: '/contractors/xiri-compliance-requirements' },
        { label: 'Equipment Specs for Surgical-Grade', href: '/contractors/equipment-specs-surgical-grade' },
    ],
};

// Which sidebar groups to show for each category
const SIDEBAR_GROUPS: Record<string, { title: string; categories: string[] }[]> = {
    medical: [
        { title: 'Related Solutions', categories: ['medical'] },
    ],
    'life-sciences': [
        { title: 'Related Solutions', categories: ['life-sciences'] },
    ],
    industrial: [
        { title: 'Related Solutions', categories: ['industrial'] },
    ],
    institutional: [
        { title: 'Related Solutions', categories: ['institutional'] },
    ],
    'contractor-trade': [
        { title: 'More Trades', categories: ['contractor-trade'] },
        { title: 'By Location', categories: ['contractor-geo'] },
        { title: 'Learn More', categories: ['contractor-keyword'] },
    ],
    'contractor-geo': [
        { title: 'Nearby Areas', categories: ['contractor-geo'] },
        { title: 'By Trade', categories: ['contractor-trade'] },
    ],
    'contractor-keyword': [
        { title: 'Opportunities', categories: ['contractor-keyword'] },
        { title: 'By Trade', categories: ['contractor-trade'] },
        { title: 'By Location', categories: ['contractor-geo'] },
    ],
    'contractor-guide': [
        { title: 'Contractor Guides', categories: ['contractor-guide'] },
        { title: 'Opportunities', categories: ['contractor-keyword'] },
        { title: 'By Trade', categories: ['contractor-trade'] },
    ],
};

interface DLPSidebarProps {
    category: string;
    currentSlug: string;
}

export function DLPSidebar({ category, currentSlug }: DLPSidebarProps) {
    const groups = SIDEBAR_GROUPS[category] || [];

    return (
        <aside className="space-y-8">
            {groups.map((group) => {
                // Collect links from all categories in this group, excluding current page
                const links = group.categories
                    .flatMap((cat) => SIDEBAR_LINKS[cat] || [])
                    .filter((link) => !link.href.endsWith(currentSlug));

                if (links.length === 0) return null;

                return (
                    <div key={group.title}>
                        <h4 className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-3">
                            {group.title}
                        </h4>
                        <nav className="space-y-1">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block text-sm text-gray-600 hover:text-sky-600 hover:bg-sky-50 px-3 py-2 rounded-lg transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                );
            })}

            {/* CTA — always present */}
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-5">
                <p className="text-sm font-bold text-gray-900 mb-2">
                    {category.startsWith('contractor') ? 'Ready to Join?' : 'Get a Free Audit'}
                </p>
                <p className="text-xs text-gray-600 mb-4">
                    {category.startsWith('contractor')
                        ? 'Apply to the XIRI contractor network today.'
                        : 'See how we can protect your facility.'}
                </p>
                <Link
                    href={category.startsWith('contractor') ? '/contractors#apply-form' : '/#audit'}
                    className="block text-center bg-sky-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-sky-700 transition-colors"
                >
                    {category.startsWith('contractor') ? 'Apply Now' : 'Schedule Audit'}
                </Link>
            </div>
        </aside>
    );
}
