import Link from 'next/link';
import { SITE } from '@/lib/constants';
import { FACILITY_TYPES, getFacilityHref, SERVICE_GROUPS } from '@/data/facility-types';

// Build footer sections from shared data
const FOOTER_SECTIONS = [
    {
        title: 'Industries',
        links: FACILITY_TYPES.map(ft => ({
            label: ft.label,
            href: getFacilityHref(ft),
        })),
    },
    {
        title: 'Services',
        links: Object.values(SERVICE_GROUPS).flatMap(g =>
            g.services.map(s => ({ label: s.label, href: `/services/${s.slug}` }))
        ).slice(0, 8),
    },
    {
        title: 'Solutions & Guides',
        links: [
            { label: 'Medical Facility Management', href: '/solutions/medical-facility-management' },
            { label: 'Single-Tenant Maintenance', href: '/solutions/single-tenant-maintenance' },
            { label: 'Vendor Management Alternative', href: '/solutions/vendor-management-alternative' },
            { label: 'JCAHO Cleaning Guide', href: '/guides/jcaho-cleaning-requirements' },
            { label: 'Accreditation 360 Guide', href: '/guides/accreditation-360-preparation-guide' },
            { label: 'Cleaning Cost Guide', href: '/guides/commercial-cleaning-cost-guide' },
            { label: 'In-House vs Outsourced', href: '/guides/inhouse-vs-outsourced-facility-management' },
        ],
    },
    {
        title: 'Directory',
        links: [
            { label: 'Location Directory', href: '/directory/locations' },
            { label: 'Specialized Solutions', href: '/directory/solutions' },
            { label: 'Join as Contractor', href: '/contractors' },
        ],
    },
];

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-gray-900 text-gray-300">
            {/* Main Footer */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
                    {/* Brand Column */}
                    <div>
                        <Link href="/" className="text-white font-heading font-bold text-2xl tracking-tight">
                            {SITE.shortName}
                        </Link>
                        <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                            {SITE.description}
                        </p>
                        <div className="mt-6">
                            <a
                                href={`mailto:${SITE.email}`}
                                className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium"
                            >
                                {SITE.email}
                            </a>
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                            <a
                                href={SITE.social.facebook}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="XIRI on Facebook"
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            </a>
                            <a
                                href={SITE.social.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="XIRI on LinkedIn"
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            </a>
                        </div>
                    </div>

                    {/* Link Columns */}
                    {FOOTER_SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                                {section.title}
                            </h3>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-gray-400 hover:text-white transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-center sm:text-left">
                            <p className="text-xs text-gray-500">
                                &copy; {currentYear} {SITE.legalName}. All rights reserved.
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                {SITE.address.full}
                            </p>
                            <p className="text-xs text-sky-500 mt-1">
                                Serving Queens, Nassau &amp; Suffolk County
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                                Privacy
                            </Link>
                            <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                                Terms
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
