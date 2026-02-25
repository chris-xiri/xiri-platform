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
            { label: 'Cleaning Cost Guide', href: '/guides/commercial-cleaning-cost-guide' },
            { label: 'In-House vs Outsourced', href: '/guides/inhouse-vs-outsourced-facility-management' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
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
