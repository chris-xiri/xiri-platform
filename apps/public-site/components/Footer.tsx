import Link from 'next/link';

const FOOTER_SECTIONS = [
    {
        title: 'Industries',
        links: [
            { label: 'Medical Offices', href: '/medical-offices' },
            { label: 'Urgent Care', href: '/urgent-care' },
            { label: 'Surgery Centers', href: '/surgery-centers' },
            { label: 'Dental Offices', href: '/dental-offices' },
            { label: 'Dialysis Centers', href: '/dialysis-centers' },
            { label: 'Veterinary Clinics', href: '/veterinary-clinics' },
            { label: 'Auto Dealerships', href: '/auto-dealerships' },
            { label: 'Daycares & Preschools', href: '/daycare-preschool' },
            { label: 'Private Schools', href: '/private-schools' },
            { label: 'Professional Offices', href: '/professional-offices' },
            { label: 'Fitness & Gyms', href: '/fitness-gyms' },
            { label: 'Retail Storefronts', href: '/retail-storefronts' },
        ],
    },
    {
        title: 'Services',
        links: [
            { label: 'Janitorial Services', href: '/services/janitorial-services' },
            { label: 'Commercial Cleaning', href: '/services/commercial-cleaning' },
            { label: 'Floor Care', href: '/services/floor-care' },
            { label: 'Window Cleaning', href: '/services/window-cleaning' },
            { label: 'HVAC Maintenance', href: '/services/hvac-maintenance' },
            { label: 'Pest Control', href: '/services/pest-control' },
            { label: 'Snow & Ice Removal', href: '/services/snow-ice-removal' },
            { label: 'Disinfecting', href: '/services/disinfecting-services' },
        ],
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
                            XIRI
                        </Link>
                        <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                            The facility management standard for single-tenant buildings. One partner. Zero headaches. Nightly verified.
                        </p>
                        <div className="mt-6">
                            <a
                                href="mailto:chris@xiri.ai"
                                className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium"
                            >
                                chris@xiri.ai
                            </a>
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                            <a
                                href="https://www.facebook.com/xirifacilitysolutions/"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="XIRI on Facebook"
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            </a>
                            <a
                                href="https://www.linkedin.com/company/xiri-facility-solutions"
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
                        <p className="text-xs text-gray-500">
                            © {currentYear} XIRI Facility Solutions. All rights reserved.
                        </p>
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
