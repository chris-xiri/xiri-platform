import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import { AuthorityBreadcrumb, PILLAR_FACILITY_HREF, PILLAR_FACILITY_TEXT } from '@/components/AuthorityBreadcrumb';
import { ArrowRight, Wrench, Bug, Trash2, Car, Hammer, Droplets, Snowflake, CheckCircle2, ShieldCheck, DollarSign, Clock } from 'lucide-react';

// ─── SEO METADATA ──────────────────────────────────────────────────

export const metadata: Metadata = {
    title: 'Facility and Building Management Services | XIRI',
    description: 'Complete facility and building management for commercial properties in Nassau County & NYC. HVAC maintenance, pest control, waste management, handyman services, pressure washing, snow removal — all under one invoice.',
    openGraph: {
        title: 'Facility and Building Management Services | XIRI',
        description: 'One vendor for every building maintenance need. HVAC, pest control, handyman, snow removal and more — fully insured, nightly audited.',
        url: 'https://xiri.ai/services/facility-management',
    },
    alternates: {
        canonical: 'https://xiri.ai/services/facility-management',
    },
};

// ─── SUB-SERVICES DATA ─────────────────────────────────────────────

const FACILITY_SERVICES = [
    {
        slug: 'hvac-maintenance',
        name: 'HVAC Maintenance',
        description: 'Preventive maintenance, filter changes, seasonal tune-ups, and emergency repair coordination for commercial HVAC systems.',
        icon: Wrench,
        features: ['Quarterly PM inspections', 'Filter replacement schedules', 'Emergency repair dispatch', '24/7 monitoring available'],
    },
    {
        slug: 'pest-control',
        name: 'Pest Control',
        description: 'Integrated Pest Management (IPM) programs for commercial facilities — rodent, insect, and wildlife exclusion with documented compliance.',
        icon: Bug,
        features: ['Monthly IPM inspections', 'Rodent \u0026 insect exclusion', 'DOH-compliant documentation', 'Emergency response'],
    },
    {
        slug: 'waste-management',
        name: 'Waste Management',
        description: 'Regulated and general waste collection, recycling programs, and compliance documentation for medical, commercial, and industrial facilities.',
        icon: Trash2,
        features: ['Regulated waste pickup', 'Recycling program setup', 'Compliance documentation', 'Container management'],
    },
    {
        slug: 'parking-lot-maintenance',
        name: 'Parking Lot Maintenance',
        description: 'Line striping, pothole repair, sweeping, lighting maintenance, and seasonal upkeep for commercial parking facilities.',
        icon: Car,
        features: ['Line striping \u0026 signage', 'Pothole \u0026 crack repair', 'Lot sweeping', 'Lighting maintenance'],
    },
    {
        slug: 'handyman-services',
        name: 'Handyman Services',
        description: 'On-demand and scheduled maintenance for drywall, plumbing, electrical, painting, fixtures, and general facility repairs.',
        icon: Hammer,
        features: ['Drywall \u0026 painting', 'Minor plumbing \u0026 electrical', 'Fixture installation', 'Scheduled \u0026 on-demand'],
    },
    {
        slug: 'pressure-washing',
        name: 'Pressure Washing',
        description: 'Exterior cleaning for building facades, sidewalks, loading docks, parking garages, and outdoor common areas.',
        icon: Droplets,
        features: ['Building facade cleaning', 'Sidewalk \u0026 entryway', 'Loading dock degreasing', 'Graffiti removal'],
    },
    {
        slug: 'snow-ice-removal',
        name: 'Snow \u0026 Ice Removal',
        description: 'Commercial snow plowing, de-icing, sidewalk clearing, and 24/7 storm response with documented compliance for slip-and-fall liability.',
        icon: Snowflake,
        features: ['Snow plowing \u0026 hauling', 'De-icing \u0026 salt application', 'Sidewalk clearing', '24/7 storm response'],
    },
];

// ─── PAGE ──────────────────────────────────────────────────────────

export default function FacilityManagementPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Structured Data */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "name": "Facility and Building Management Services",
                    "description": "Complete facility and building management for commercial properties. HVAC, pest control, waste, handyman, pressure washing, parking lot, and snow removal services.",
                    "serviceType": "Facility Management",
                    "areaServed": "New York",
                    "provider": {
                        "@type": "Organization",
                        "@id": "https://xiri.ai/#organization"
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://xiri.ai" },
                        { "@type": "ListItem", "position": 2, "name": PILLAR_FACILITY_TEXT, "item": `https://xiri.ai${PILLAR_FACILITY_HREF}` },
                    ]
                }}
            />

            {/* Breadcrumb */}
            <AuthorityBreadcrumb
                items={[]}
                pillar={{ href: PILLAR_FACILITY_HREF, text: PILLAR_FACILITY_TEXT }}
            />

            {/* Hero */}
            <Hero
                title="Facility and Building Management Services"
                subtitle="One vendor for every building maintenance need — HVAC, pest control, handyman, snow removal and more. Fully insured, nightly audited, consolidated billing."
                ctaText="Get a Facility Audit"
                ctaLink="/#audit"
            />

            {/* Value Props */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { icon: ShieldCheck, title: '$1M Insured', desc: 'Every contractor carries a $1M liability policy.' },
                            { icon: Clock, title: 'Nightly Audits', desc: 'Our Night Manager physically verifies work every night.' },
                            { icon: DollarSign, title: 'One Invoice', desc: 'Consolidate all maintenance into one monthly bill.' },
                            { icon: CheckCircle2, title: 'Vetted Vendors', desc: 'Background-checked, licensed, and performance-tracked.' },
                        ].map((prop) => (
                            <div key={prop.title} className="text-center">
                                <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <prop.icon className="w-7 h-7 text-sky-600" />
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">{prop.title}</h3>
                                <p className="text-sm text-slate-600">{prop.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            Complete Building Maintenance Under One Roof
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Stop juggling seven vendors with seven invoices. XIRI manages every aspect of your building&apos;s maintenance so you can focus on your tenants.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {FACILITY_SERVICES.map((service) => (
                            <Link
                                key={service.slug}
                                href={`/services/${service.slug}`}
                                className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <service.icon className="w-6 h-6 text-sky-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-sky-700 transition-colors">
                                    {service.name}
                                </h3>
                                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                                    {service.description}
                                </p>
                                <ul className="space-y-2 mb-6">
                                    {service.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <span className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cross-link to Commercial Cleaning */}
            <section className="py-16 bg-sky-50 border-y border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        Need Cleaning Services Too?
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Most of our facility management clients also use our{' '}
                        <Link href="/services/commercial-cleaning" className="text-sky-700 font-medium hover:underline">
                            Commercial Cleaning Services
                        </Link>
                        . Bundle them under one invoice for maximum savings and coordination.
                    </p>
                    <Link
                        href="/services/commercial-cleaning"
                        className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                    >
                        Explore Commercial Cleaning →
                    </Link>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to Consolidate Your Building Maintenance?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Book a free facility audit. We&apos;ll walk your property, identify maintenance gaps, and build a custom scope — all under one insured, audited vendor.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Facility Audit"
                        className="inline-block bg-sky-500 text-white px-10 py-4 rounded-xl text-lg font-bold hover:bg-sky-400 transition-colors shadow-lg"
                    />
                </div>
            </section>
        </div>
    );
}
