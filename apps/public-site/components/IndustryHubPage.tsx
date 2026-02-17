import { SeoIndustry, SeoService } from "@xiri/shared";
import { Hero } from "@/components/Hero";
import { ValuePropsSection } from "@/components/ValueProps";
import { ClientLeadForm } from "@/components/ClientLeadForm";
import { FAQ } from "@/components/FAQ";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import seoData from "@/data/seo-data.json";

interface IndustryHubPageProps {
    industry: SeoIndustry;
}

export function IndustryHubPage({ industry }: IndustryHubPageProps) {
    // 1. Resolve Services (IDs to Objects)
    const allServices = (seoData.services || []) as SeoService[];

    const coreServices = industry.coreServices.map(id =>
        allServices.find(s => s.slug === id)
    ).filter(Boolean) as SeoService[];

    const specializedServices = industry.specializedServices?.map(id =>
        allServices.find(s => s.slug === id)
    ).filter(Boolean) as SeoService[] || [];

    return (
        <main className="min-h-screen bg-slate-50">
            {/* 1. HERO */}
            <Hero
                title={industry.heroTitle || `${industry.name} Facility Management`}
                subtitle={industry.heroSubtitle || "Standardized cleaning and compliance for single-tenant facilities."}
                ctaText="Get a Facility Audit"
                ctaLink="#audit"
            />

            {/* 2. VALUE PROPS (Generic XIRI Props) */}
            <ValuePropsSection
                title={`Why ${industry.name} Choose XIRI`}
            />

            {/* 3. CORE SERVICES GRID */}
            <section className="py-20 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            Complete Facility Management
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Consolidate your vendor list. We manage every aspect of your facility's maintenance.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {coreServices.map((service) => (
                            <div key={service.slug} className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">
                                    {service.valueProps?.[0]?.icon || "🔧"}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{service.name}</h3>
                                <p className="text-slate-600 mb-6">{service.shortDescription}</p>
                                <ul className="space-y-2 mb-8">
                                    {service.benefits?.slice(0, 3).map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={`/services/${service.slug}`}
                                    className="font-semibold text-sky-600 flex items-center gap-2 group-hover:gap-3 transition-all"
                                >
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. SPECIALIZED SERVICES (if any) */}
            {specializedServices.length > 0 && (
                <section className="py-20 bg-slate-50 border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h3 className="text-xl font-bold text-slate-900 mb-8">Specialized Add-ons</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {specializedServices.map((service) => (
                                <Link
                                    key={service.slug}
                                    href={`/services/${service.slug}`}
                                    className="p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-500 hover:shadow-md transition-all flex items-center gap-3"
                                >
                                    <span className="text-2xl">{service.valueProps?.[0]?.icon}</span>
                                    <span className="font-medium text-slate-700">{service.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* LEAD FORM SECTION (Anchor: #audit) */}
            <section id="audit" className="py-24 bg-sky-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <div className="text-white">
                            <div className="inline-block px-4 py-2 rounded-full bg-sky-800 text-sky-200 font-bold text-sm mb-6 border border-sky-700">
                                🚀 Start Your Transformation
                            </div>
                            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                                Ready to elevate your facility management?
                            </h2>
                            <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                                Stop worrying about missing shifts, empty supplies, and failed inspections. Let XIRI build a custom scope of work for your facility today.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        🛡️
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">100% Insured & Vetted</h4>
                                        <p className="text-sky-200/80">$1M Liability Policy for every single contractor.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        🌙
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Nightly Audits</h4>
                                        <p className="text-sky-200/80">We physically verify the work every night so you don't have to.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                                        💰
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Consolidated Billing</h4>
                                        <p className="text-sky-200/80">One invoice for janitorial, supplies, and maintenance.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Lead Form (Industry Mode) */}
                        <div className="lg:pl-10">
                            <ClientLeadForm
                                industryName={industry.name}
                                prefilledService={industry.coreServices[0]}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. FAQs */}
            {industry.faqs && industry.faqs.length > 0 && (
                <FAQ items={industry.faqs} />
            )}
        </main>
    );
}
