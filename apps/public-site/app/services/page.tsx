import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import seoData from '@/data/seo-data.json';
import { SITE, CTA } from '@/lib/constants';

export const metadata: Metadata = {
    title: `All Services | ${SITE.name}`,
    description: 'Explore all XIRI facility services — janitorial, floor care, HVAC, pest control, and more. One partner for every building need, nightly verified.',
    alternates: {
        canonical: `${SITE.url}/services`,
    },
};

interface SeoService {
    slug: string;
    name: string;
    shortDescription: string;
    heroTitle?: string;
    category?: string;
}

// Group services by pillar
const CATEGORIES: Record<string, { label: string; href: string; slugs: string[] }> = {
    'Cleaning': {
        label: 'Commercial Cleaning',
        href: '/services/commercial-cleaning',
        slugs: ['janitorial-services', 'commercial-cleaning', 'medical-office-cleaning', 'urgent-care-cleaning', 'surgery-center-cleaning', 'daycare-cleaning', 'floor-care', 'carpet-upholstery', 'disinfecting-services', 'window-cleaning', 'day-porter', 'post-construction-cleanup'],
    },
    'Facility': {
        label: 'Facility Management',
        href: '/services/facility-management',
        slugs: ['hvac-maintenance', 'pest-control', 'waste-management', 'parking-lot-maintenance', 'handyman-services', 'pressure-washing', 'snow-ice-removal'],
    },
};

export default function ServicesIndex() {
    const allServices = (seoData as any).services || [];

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${SITE.url}/services` },
                    ]
                }}
            />

            {/* Hero */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-sky-50 to-white border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-3">Our Services</p>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
                        Every Service Your Building Needs
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        From nightly janitorial to HVAC maintenance — one partner, one invoice, every shift verified.
                    </p>
                </div>
            </section>

            {/* Service Categories */}
            <section className="py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    {Object.entries(CATEGORIES).map(([key, cat]) => {
                        const services = cat.slugs
                            .map(slug => allServices.find((s: SeoService) => s.slug === slug))
                            .filter(Boolean) as SeoService[];

                        if (services.length === 0) return null;

                        return (
                            <div key={key} className="mb-16 last:mb-0">
                                <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">
                                    <Link href={cat.href} className="hover:text-sky-600 transition-colors">
                                        {cat.label} →
                                    </Link>
                                </h2>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {services.map(service => (
                                        <Link
                                            key={service.slug}
                                            href={`/services/${service.slug}`}
                                            className="group block p-5 rounded-xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all"
                                        >
                                            <h3 className="font-semibold text-slate-900 group-hover:text-sky-600 transition-colors mb-1">
                                                {service.heroTitle || service.name}
                                            </h3>
                                            <p className="text-sm text-slate-500 line-clamp-2">
                                                {service.shortDescription}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 bg-sky-900 text-white text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-heading font-bold mb-4">Not sure what you need?</h2>
                    <p className="text-sky-100 text-lg mb-8">
                        We&apos;ll walk your facility and build a custom scope — for free.
                    </p>
                    <Link
                        href="/#audit"
                        className="inline-flex items-center bg-white text-sky-900 px-8 py-4 rounded-full text-lg font-medium shadow-lg hover:bg-sky-50 transition-all"
                    >
                        {CTA.primary}
                    </Link>
                </div>
            </section>
        </div>
    );
}
