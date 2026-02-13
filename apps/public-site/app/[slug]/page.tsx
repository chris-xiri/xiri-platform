import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { ValuePropsSection } from '@/components/ValueProps';
import { CTAButton } from '@/components/CTAButton';
import { NearbyAreas } from '@/components/NearbyAreas';
import combinedData from '@/data/seo-data.json';
import { ServiceTracker } from '@/components/ServiceTracker';
import { JsonLd } from '@/components/JsonLd';
import { LeadForm } from '@/components/LeadForm';
import { SeoService, SeoIndustry } from '@xiri/shared';

// ----------------------------------------------------------------------
// GENERATE STATIC PARAMS (For BOTH Industries and Services)
// ----------------------------------------------------------------------
export async function generateStaticParams() {
    // 1. Service Slugs
    const serviceParams = combinedData.services.map((service) => ({
        slug: service.slug,
    }));

    // 2. Industry Slugs
    const industryParams = (combinedData.industries || []).map((industry) => ({
        slug: industry.slug,
    }));

    return [...serviceParams, ...industryParams];
}

// ----------------------------------------------------------------------
// METADATA GENERATION
// ----------------------------------------------------------------------
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;

    // Check Industry
    const industry = (combinedData.industries || []).find((i) => i.slug === slug);
    if (industry) {
        return {
            title: `${industry.heroTitle} | XIRI`,
            description: industry.heroSubtitle,
        };
    }

    // Check Service
    const service = combinedData.services.find((s) => s.slug === slug);
    if (service) {
        return {
            title: `${service.heroTitle} | XIRI`,
            description: service.shortDescription,
        };
    }

    return {
        title: 'Facility Services | XIRI',
    };
}

export const dynamicParams = true; // Allow new routes to be generated on demand

// ----------------------------------------------------------------------
// PAGE COMPONENT
// ----------------------------------------------------------------------
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // 1. Try to find Industry
    const industry = (combinedData.industries || []).find((i) => i.slug === slug);
    if (industry) {
        return <IndustryHubPage industry={industry} />;
    }

    // 2. Try to find Service
    const service = combinedData.services.find((s) => s.slug === slug);
    if (service) {
        return <ServiceDetailPage service={service as unknown as SeoService} />;
    }

    // 3. 404
    notFound();
}

// ----------------------------------------------------------------------
// SUB-COMPONENT: INDUSTRY HUB (NEW)
// ----------------------------------------------------------------------
function IndustryHubPage({ industry }: { industry: SeoIndustry }) {
    // 1. Get Core Services (Top 6)
    const coreServices = industry.coreServices.map(slug => combinedData.services.find(s => s.slug === slug)).filter(Boolean);

    // 2. Get All Other Services (For SEO List)
    // Filter out core services AND ensure we only show "General" services (targetFacilityType === 'other')
    // This removes specific cleaning variations like "Medical Office Cleaning" from the general list.
    const allOtherServices = combinedData.services.filter(s =>
        !industry.coreServices.includes(s.slug) &&
        s.targetFacilityType === 'other'
    );

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "name": industry.name,
                    "description": industry.heroSubtitle,
                    "serviceType": "Facility Management",
                    "areaServed": "New York"
                }}
            />

            <Hero
                title={industry.heroTitle}
                subtitle={industry.heroSubtitle}
                ctaText="Get a Facility Proposal"
            />

            {/* TRUST / BENEFITS SECTION */}
            {industry.benefits && (
                <section className="py-12 bg-white border-b border-gray-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-3 gap-8">
                            {industry.benefits.map((benefit, i) => (
                                <div key={i} className="flex items-start space-x-4 p-6 rounded-2xl bg-sky-50/50 border border-sky-100 hover:shadow-md transition-all">
                                    <div className="flex-shrink-0 text-3xl text-sky-600">
                                        {/* Simple Icon Mapping or Emoji fallback */}
                                        {benefit.icon === 'user-tie' && '👔'}
                                        {benefit.icon === 'checklist' && '📋'}
                                        {benefit.icon === 'invoice' && '🧾'}
                                        {benefit.icon === 'lightning' && '⚡'}
                                        {benefit.icon === 'shield' && '🛡️'}
                                        {benefit.icon === 'clipboard-check' && '✅'}
                                        {benefit.icon === 'microscope' && '🔬'}
                                        {benefit.icon === 'sparkles' && '✨'}
                                        {benefit.icon === 'moon' && '🌙'}
                                        {benefit.icon === 'baby-carriage' && '🧸'}
                                        {benefit.icon === 'shield-check' && '👮'}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold font-heading text-gray-900">{benefit.title}</h3>
                                        <p className="text-gray-600 text-sm mt-1">{benefit.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* PROCESS SECTION */}
            <section className="py-20 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">How XIRI Works</h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">A managed solution that bridges the gap between you and the contractor.</p>
                    </div>
                    <div className="relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-100 -z-10"></div>

                        <div className="grid md:grid-cols-3 gap-12">
                            {/* Step 1 */}
                            <div className="relative bg-white p-8 text-center group rounded-2xl border border-transparent hover:border-gray-100 transition-all">
                                <div className="w-24 h-24 mx-auto bg-sky-50 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                    🔍
                                </div>
                                <h3 className="text-xl font-bold font-heading text-gray-900 mb-3">1. Walkthrough & Scope</h3>
                                <p className="text-gray-600 leading-relaxed">We meet on-site to build a custom scope of work tailored to your facility type.</p>
                            </div>

                            {/* Step 2 */}
                            <div className="relative bg-white p-8 text-center group rounded-2xl border border-transparent hover:border-gray-100 transition-all">
                                <div className="w-24 h-24 mx-auto bg-sky-50 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                    📝
                                </div>
                                <h3 className="text-xl font-bold font-heading text-gray-900 mb-3">2. Consolidated Proposal</h3>
                                <p className="text-gray-600 leading-relaxed">You receive a single fixed-price proposal covering cleaning, supplies, and maintenance.</p>
                            </div>

                            {/* Step 3 */}
                            <div className="relative bg-white p-8 text-center group rounded-2xl border border-transparent hover:border-gray-100 transition-all">
                                <div className="w-24 h-24 mx-auto bg-sky-50 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                    🤝
                                </div>
                                <h3 className="text-xl font-bold font-heading text-gray-900 mb-3">3. Managed Execution</h3>
                                <div className="text-gray-600 text-sm bg-gray-50 rounded-xl p-4 mt-2">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                                        <span className="font-semibold text-sky-700">Daytime</span>
                                        <span>Your FSM</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-surgical-700">Nighttime</span>
                                        <span>Night Manager</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CORE SERVICES (6 Cards) */}
            <section className="py-20 bg-gray-50/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">Core Facility Services</h2>
                        <p className="text-xl text-gray-600">The essential services every {industry.name} needs.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {coreServices.map((service: any) => (
                            <Link key={service.slug} href={`/${service.slug}`} className="block group h-full">
                                <div className="bg-white rounded-2xl p-8 h-full border border-gray-100 shadow-sm hover:shadow-xl hover:border-sky-200 transition-all duration-300 flex flex-col relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                                    <div className="relative text-4xl mb-6 group-hover:scale-110 transition-transform duration-300 origin-left">
                                        {service.valueProps?.[0]?.icon || '✨'}
                                    </div>
                                    <h3 className="relative text-2xl font-bold font-heading text-gray-900 mb-3 group-hover:text-sky-600 transition-colors">
                                        {service.name}
                                    </h3>
                                    <p className="relative text-gray-600 mb-6 flex-grow leading-relaxed">{service.shortDescription}</p>
                                    <span className="relative text-sky-600 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center mt-auto text-sm uppercase tracking-wide">
                                        View Service
                                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* SEO LIST: "Services We Manage" */}
            <section className="py-20 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">Complete Service Catalog</h2>
                        <p className="text-xl text-gray-600">Comprehensive facility solutions for single-tenant commercial properties.</p>
                    </div>

                    {/* SEO-Optimized List/Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {allOtherServices.map((service) => (
                            <Link key={service.slug} href={`/${service.slug}`} className="group block">
                                <div className="h-full p-4 rounded-xl hover:bg-gray-50 transition-colors -mx-4">
                                    <h3 className="text-lg font-bold font-heading text-gray-900 mb-2 group-hover:text-sky-600 flex items-center gap-2">
                                        {service.valueProps?.[0]?.icon && <span className="text-xl opacity-70 group-hover:opacity-100">{service.valueProps[0].icon}</span>}
                                        {service.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                                        {service.shortDescription}
                                    </p>
                                    <span className="text-sky-600 text-xs font-bold uppercase tracking-wider group-hover:underline">
                                        Learn More
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* LOCAL SEO INTERLINKING GRID (New) */}
            <section className="py-16 bg-gray-50/50 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-8">Serving {industry.name} Across New York</h3>
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
                        {combinedData.locations.map((loc) => (
                            <Link
                                key={loc.slug}
                                href={`/${industry.coreServices[0] || 'commercial-cleaning'}/${loc.slug}`}
                                className="text-gray-500 hover:text-sky-600 text-sm font-medium transition-colors"
                            >
                                {loc.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* INDUSTRY FAQs (New) */}
            {industry.faqs && (
                <section className="py-20 bg-white">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-heading font-bold text-center mb-12 text-gray-900">Common Questions</h2>
                        <div className="space-y-4">
                            {industry.faqs.map((faq, i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-gray-200 transition-colors">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-start">
                                        <span className="text-sky-600 mr-3 text-xl">Q.</span>
                                        {faq.question}
                                    </h3>
                                    <p className="text-gray-600 pl-8 leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* LEAD FORM SECTION (Anchor: #survey) */}
            <section id="survey" className="py-24 bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-sky-50/50 skew-y-3 transform origin-bottom-right"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left: Copy */}
                        <div>
                            <div className="inline-block px-4 py-2 rounded-full bg-sky-100 text-sky-700 font-bold text-sm mb-6">
                                🚀 Ready for a Change?
                            </div>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-6 leading-tight">
                                Get a compliance audit for your {industry.name}.
                            </h2>
                            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                                Stop worrying about missed shifts and failed inspections. Let XIRI build a custom scope of work for your facility today.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">✓</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">100% Guaranteed</h4>
                                        <p className="text-sm text-gray-600">If we miss a spot, we fix it immediately.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">🛡️</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Fully Insured & Vetted</h4>
                                        <p className="text-sm text-gray-600">$5M Liability Policy for every contractor.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div>
                            <LeadForm industryName={industry.name} />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENT: SERVICE DETAIL (EXISTING LOGIC)
// ----------------------------------------------------------------------
function ServiceDetailPage({ service }: { service: SeoService }) {
    return (
        <div className="min-h-screen bg-white">
            <ServiceTracker
                service={service.slug}
                location="hub"
            />

            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "name": service.name,
                    "description": service.shortDescription,
                    "serviceType": "Facility Management",
                    "areaServed": "New York"
                }}
            />

            <Hero
                title={service.heroTitle || service.name}
                subtitle={service.heroSubtitle || service.shortDescription}
                ctaText="Get a Quote"
            />

            <ValuePropsSection
                title={`Why Choose XIRI for ${service.name}`}
                items={service.valueProps || []}
            />

            {/* Features (Original content) */}
            <section className="py-16 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                        Comprehensive {service.name}
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {service.features?.map((feature, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="text-3xl mb-4">{feature.icon}</div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-gray-600 text-sm">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Internal Linking to Local Pages (Spider Web) */}
            <section className="py-16 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-8">Serving Medical Facilities Across NY</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {combinedData.locations.map((loc) => (
                            <Link
                                key={loc.slug}
                                href={`/${service.slug}/${loc.slug}`}
                                className="text-gray-600 hover:text-blue-600 hover:underline"
                            >
                                {loc.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <section className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {service.faqs?.map((faq, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-6">
                                <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                                <p className="text-gray-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 bg-blue-600">
                <div className="max-w-4xl mx-auto text-center px-4">
                    <h2 className="text-3xl font-bold text-white mb-6">Ready to get started?</h2>
                    <p className="text-blue-100 text-xl mb-8">Get a free walkthrough and proposal within 24 hours.</p>
                    <CTAButton
                        href="/contact"
                        text="Schedule Walkthrough"
                        location={`hub_${service.slug}`}
                        className="bg-white text-blue-600 hover:bg-gray-100"
                    />
                </div>
            </section>
        </div>
    );
}
