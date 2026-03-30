import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { CTAButton } from '@/components/CTAButton';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { ArrowRight, Bug, Wrench, Hammer, Droplets, ClipboardCheck, ShieldCheck, DollarSign, Clock, TrendingDown, CheckCircle2, Package } from 'lucide-react';
import { SITE } from '@/lib/constants';

// ─── SEO METADATA ──────────────────────────────────────────────────

export const metadata: Metadata = {
    title: 'Preventive Maintenance Programs for Commercial Buildings | XIRI',
    description: 'Stop paying for emergencies. XIRI\'s preventive maintenance programs coordinate cleaning, pest control, HVAC, handyman, and supply management — all verified, all under one invoice.',
    openGraph: {
        title: 'Preventive Maintenance Programs | XIRI Facility Solutions',
        description: 'One partner for every building maintenance need. Scheduled inspections, verified vendor coordination, and documented compliance — so nothing breaks and nothing gets missed.',
        url: 'https://xiri.ai/services/preventive-maintenance',
    },
    alternates: {
        canonical: 'https://xiri.ai/services/preventive-maintenance',
    },
};

// ─── SUB-SERVICES DATA ─────────────────────────────────────────────

const PM_SERVICES = [
    {
        slug: 'hvac-maintenance',
        name: 'HVAC Maintenance',
        description: 'Scheduled filter changes, vent cleaning, and quarterly system inspections to prevent breakdowns, reduce energy costs, and keep air quality compliant.',
        icon: Wrench,
        features: ['Monthly/quarterly filter swaps', 'Vent & diffuser cleaning', 'Seasonal tune-ups', 'Emergency repair coordination'],
    },
    {
        slug: 'pest-control',
        name: 'Pest Control & IPM',
        description: 'Integrated Pest Management with scheduled bait station checks, perimeter treatments, and compliance documentation — so you never scramble before an inspection.',
        icon: Bug,
        features: ['Monthly trap inspections', 'Perimeter treatment', 'DOH-compliant records', 'Same-day emergency response'],
    },
    {
        slug: 'handyman-services',
        name: 'Handyman & Minor Repairs',
        description: 'On-demand and scheduled repairs for drywall, plumbing, electrical, fixtures, and painting — before small issues become expensive problems.',
        icon: Hammer,
        features: ['Drywall & painting', 'Minor plumbing & electrical', 'Fixture installation', 'Scheduled & on-demand'],
    },
    {
        slug: 'janitorial-services',
        name: 'Nightly Cleaning & Audits',
        description: 'Verified nightly cleaning with zone-by-zone documentation. Every area checked, every task logged, every shift audited.',
        icon: ClipboardCheck,
        features: ['Zone-by-zone verification', 'Nightly manager audits', 'Real-time shift logs', 'Photo documentation'],
    },
    {
        slug: 'waste-management',
        name: 'Waste & Recycling Management',
        description: 'Regulated and general waste collection, recycling programs, and container management — all documented for compliance.',
        icon: Droplets,
        features: ['Regulated waste pickup', 'Recycling programs', 'Container management', 'Compliance documentation'],
    },
    {
        name: 'Supply & Consumable Management',
        slug: '',
        description: 'Proactive restocking of paper goods, soap, liners, and cleaning supplies — tracked and reordered before you run out.',
        icon: Package,
        features: ['Automatic reorder alerts', 'Monthly usage tracking', 'Consolidated procurement', 'Delivery coordination'],
    },
];

// ─── COST SAVINGS STATS ────────────────────────────────────────────

const STATS = [
    { stat: '25–30%', label: 'less spent on emergency repairs with a PM program vs. reactive maintenance' },
    { stat: '4–5×', label: 'return on every dollar invested in preventive maintenance' },
    { stat: '10–20%', label: 'lower energy costs through properly maintained HVAC systems' },
    { stat: '40–60%', label: 'fewer equipment failures with scheduled inspections' },
];

// ─── PAGE ──────────────────────────────────────────────────────────

export default function PreventiveMaintenancePage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Structured Data — Service + OfferCatalog */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "@id": "https://xiri.ai/services/preventive-maintenance#service",
                    "name": "Preventive Maintenance Programs",
                    "description": "Comprehensive preventive maintenance programs for commercial buildings. Cleaning verification, pest control, HVAC maintenance, handyman services, and supply management — all coordinated under one vendor.",
                    "serviceType": "Preventive Maintenance",
                    "provider": {
                        "@type": "Organization",
                        "@id": `${SITE.url}/#organization`
                    },
                    "areaServed": {
                        "@type": "State",
                        "name": "New York"
                    },
                    "hasOfferCatalog": {
                        "@type": "OfferCatalog",
                        "name": "Preventive Maintenance Services",
                        "itemListElement": PM_SERVICES.filter(s => s.slug).map((svc, i) => ({
                            "@type": "Offer",
                            "position": i + 1,
                            "itemOffered": {
                                "@type": "Service",
                                "name": svc.name,
                                "url": `${SITE.url}/services/${svc.slug}`
                            }
                        }))
                    }
                }}
            />
            {/* LocalBusiness — deep-link service areas */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "LocalBusiness",
                    "@id": "https://xiri.ai/#localbusiness",
                    "name": SITE.name,
                    "url": SITE.url,
                    "telephone": "+1-516-399-0350",
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Garden City",
                        "addressRegion": "NY",
                        "postalCode": "11530",
                        "addressCountry": "US"
                    },
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "40.7268",
                        "longitude": "-73.6343"
                    },
                    "areaServed": [
                        { "@type": "County", "name": "Nassau County", "containedInPlace": { "@type": "State", "name": "New York" } },
                        { "@type": "County", "name": "Suffolk County", "containedInPlace": { "@type": "State", "name": "New York" } },
                        { "@type": "Borough", "name": "Queens", "containedInPlace": { "@type": "City", "name": "New York" } },
                    ],
                    "makesOffer": {
                        "@type": "Offer",
                        "itemOffered": {
                            "@type": "Service",
                            "@id": "https://xiri.ai/services/preventive-maintenance#service"
                        }
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": "Preventive Maintenance Programs", "item": `${SITE.url}/services/preventive-maintenance` },
                    ]
                }}
            />

            {/* Breadcrumb */}
            <AuthorityBreadcrumb
                items={[]}
                pillar={{ href: '/services/preventive-maintenance', text: 'Preventive Maintenance Programs' }}
            />

            {/* Hero */}
            <Hero
                title="Preventive Maintenance Programs"
                subtitle="Stop paying for emergencies. We coordinate every vendor, verify every service, and catch problems before they cost you — all under one invoice."
                ctaText="Get a Free Facility Audit"
                ctaLink="/#audit"
            />

            {/* The Problem */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold font-heading text-slate-900 mb-4">
                            Most Building Managers Are Stuck in Reactive Mode
                        </h2>
                        <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                            Something breaks, you call someone, you pay emergency rates. Meanwhile, the filter that hasn&apos;t been changed in six months is silently costing you 15% more on energy. A preventive maintenance program flips the script.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { icon: TrendingDown, title: 'Lower Costs', desc: 'PM reduces emergency repairs by 25–30% and cuts overall operating expenses by 12–18%.' },
                            { icon: ShieldCheck, title: 'Stay Compliant', desc: 'Documented service logs for JCAHO, DOH, and OSHA — ready when the inspector knocks.' },
                            { icon: DollarSign, title: 'One Invoice', desc: 'Stop juggling seven vendors. One partner, one monthly bill, one point of accountability.' },
                            { icon: Clock, title: 'Nothing Gets Missed', desc: 'Every service scheduled, every vendor coordinated, every task verified.' },
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

            {/* Cost Savings Stats */}
            <section className="py-16 bg-emerald-50 border-b border-emerald-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-center text-slate-900 mb-10">
                        The Numbers Behind Preventive Maintenance
                    </h2>
                    <div className="grid md:grid-cols-4 gap-6">
                        {STATS.map((s, i) => (
                            <div key={i} className="bg-white rounded-2xl p-6 border border-emerald-100 text-center shadow-sm">
                                <div className="text-3xl font-bold text-emerald-600 mb-2">{s.stat}</div>
                                <p className="text-sm text-slate-600">{s.label}</p>
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
                            What&apos;s Included in Your Maintenance Program
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Every service below is scheduled, coordinated, and verified. You get a single dashboard showing what happened, who did it, and when.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {PM_SERVICES.map((service) => {
                            const CardContent = (
                                <>
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
                                    {service.slug && (
                                        <span className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all">
                                            Learn More <ArrowRight className="w-4 h-4" />
                                        </span>
                                    )}
                                </>
                            );

                            if (service.slug) {
                                return (
                                    <Link
                                        key={service.slug}
                                        href={`/services/${service.slug}`}
                                        className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1"
                                    >
                                        {CardContent}
                                    </Link>
                                );
                            }

                            return (
                                <div
                                    key={service.name}
                                    className="group p-8 rounded-2xl bg-slate-50 border border-slate-100"
                                >
                                    {CardContent}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-center text-slate-900 mb-10">
                        How It Works
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'We Audit Your Building', desc: 'Free site walk. We identify every maintenance need — cleaning, pest, HVAC, repairs, supplies — and build a custom scope.' },
                            { step: '02', title: 'We Set the Schedule', desc: 'Every service gets a cadence: nightly cleaning, monthly pest checks, quarterly HVAC tune-ups. All coordinated, nothing overlaps.' },
                            { step: '03', title: 'We Verify Everything', desc: 'Every shift logged, every vendor accountable, every service documented. You see it all on your dashboard — or we send you a summary.' },
                        ].map((item) => (
                            <div key={item.step} className="text-center">
                                <div className="text-4xl font-bold text-sky-200 mb-3">{item.step}</div>
                                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cross-link to other pillars */}
            <section className="py-16 bg-sky-50 border-y border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        Already Have Cleaning Covered?
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Add pest control, HVAC, and handyman services to your existing cleaning contract. Bundle everything under one preventive maintenance program and save.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/services/commercial-cleaning"
                            className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                        >
                            Commercial Cleaning →
                        </Link>
                        <Link
                            href="/services/facility-management"
                            className="inline-block bg-white text-sky-700 px-8 py-3.5 rounded-xl font-bold border border-sky-200 hover:bg-sky-50 transition-colors"
                        >
                            Facility Management →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to Stop Paying for Emergencies?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                        Book a free facility audit. We&apos;ll walk your property, build a maintenance plan, and show you exactly how much you&apos;ll save — before you sign anything.
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
