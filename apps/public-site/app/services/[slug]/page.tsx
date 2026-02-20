import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { ValuePropsSection } from '@/components/ValueProps';
import { ServiceTracker } from '@/components/ServiceTracker';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { NearbyAreas } from '@/components/NearbyAreas';
import seoData from '@/data/seo-data.json';
import { PARTNER_MARKETS } from '@/data/partnerMarkets';
import { SeoService } from '@xiri/shared';
// FIX: Add Lucide imports
import { MapPin, Eye } from 'lucide-react';

interface Location {
    slug: string;
    name: string;
    state: string;
    region: string;
    landmarks?: string[];
    nearbyCities?: string[];
}

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

// Generate all Service + Location combinations
export async function generateStaticParams() {
    const params = [];

    // 1. Service Hubs (e.g. /medical-office-cleaning)
    for (const service of seoData.services) {
        params.push({ slug: service.slug });
    }

    // 2. Service Locations (e.g. /medical-office-cleaning-in-garden-city-nassau-ny)
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    for (const service of seoData.services) {
        for (const location of seoData.locations) {
            const countySlug = slugify(location.region);
            const townSlug = slugify(location.name.split(',')[0]);
            const stateSlug = "ny";
            const flatSlug = `${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}`;
            params.push({ slug: flatSlug });
        }
    }
    return params;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'SERVICE') {
        const service = data as any;
        return {
            title: `${service.heroTitle || service.name} | XIRI`,
            description: service.shortDescription,
            alternates: {
                canonical: `https://xiri.ai/services/${service.slug}`
            },
            openGraph: {
                title: `${service.heroTitle || service.name} | XIRI`,
                description: service.shortDescription,
                url: `https://xiri.ai/services/${service.slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    } else if (type === 'LOCATION') {
        const { service, location } = data as any;
        return {
            title: `${service.name} in ${location.name} | XIRI`,
            description: `Professional ${service.name} in ${location.name}. ${service.shortDescription}`,
            alternates: {
                canonical: `https://xiri.ai/services/${slug}`
            },
            openGraph: {
                title: `${service.name} in ${location.name} | XIRI`,
                description: `Professional ${service.name} in ${location.name}. ${service.shortDescription}`,
                url: `https://xiri.ai/services/${slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    }

    return {};
}

export default async function ServicePage({ params }: Props) {
    const { slug } = await params;
    const { type, data } = parseSlug(slug);

    if (type === 'NOT_FOUND') {
        notFound();
    }

    // --- CASE A: Service Hub ---
    if (type === 'SERVICE') {
        // Reuse the logic from the old service detail page
        // But for cleaner code, we can just render the logic here or import a component.
        // Since we don't have a separate exported component verified, implementing inline for safety.
        const service = data as SeoService;
        return (
            <div className="min-h-screen bg-white">
                <ServiceTracker service={service.slug} location="hub" />
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
                {/* Features */}
                <section className="py-16 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                            Comprehensive {service.name}
                        </h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {service.features?.map((feature, i) => (
                                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="text-3xl mb-4 text-sky-600">
                                        {/* Simple icon mapping */}
                                        {feature.icon === 'sparkles' ? '✨' : feature.icon === 'shield' ? '🛡️' : '📋'}
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 text-sm">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                {/* FAQs */}
                <FAQ items={service.faqs || []} />
            </div>
        );
    }

    // --- CASE B: Service Location Page ---
    const { service, location } = data as { service: SeoService, location: Location };

    // Inject Landmarks into Hero
    const heroTitle = `${service.name} in ${location.name}`;
    const heroSubtitle = `${service.shortDescription} Proudly serving medical facilities near ${location.landmarks?.join(', ') || location.region}.`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: `XIRI ${service.name} ${location.name}`,
        description: service.shortDescription,
        areaServed: {
            '@type': 'Place',
            name: location.region,
            address: {
                '@type': 'PostalAddress',
                addressLocality: location.name,
                addressRegion: location.state,
            }
        },
        url: `https://xiri.ai/services/${slug}`,
        department: {
            '@type': 'ProfessionalService',
            name: service.name,
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={jsonLd} />
            <ServiceTracker service={service.slug} location={location.slug} />

            {/* Dynamic Hero */}
            <Hero
                title={heroTitle}
                subtitle={heroSubtitle}
                ctaText={`Get a Quote for ${location.name}`}
            />

            {/* Localized Content Section */}
            <section className="py-12 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                        Why Choose XIRI for {service.name} in {location.name}?
                    </h2>
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <p className="text-lg text-gray-600 mb-6">
                                Running a business in <strong>{location.name}</strong> comes with unique challenges.
                                Whether it's dealing with the local climate or meeting specific regulatory standards in <strong>{location.state}</strong>,
                                XIRI understands what it takes to keep your facility pristine.
                            </p>
                            <p className="text-lg text-gray-600 mb-6">
                                Our <strong>{service.name}</strong> service is designed to take the burden off your management team.
                            </p>
                            <ul className="space-y-4">
                                {service.benefits && service.benefits.map((benefit, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="text-green-500 mr-2">✓</span>
                                        <span className="text-gray-700 font-medium">{typeof benefit === 'string' ? benefit : benefit.title}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gray-100 rounded-xl p-8 h-full flex items-center justify-center min-h-[300px]">
                            <div className="text-center">
                                <span className="text-6xl mb-4 block">📍</span>
                                <h3 className="text-2xl font-bold text-gray-900">Serving {location.name}</h3>
                                <p className="text-gray-500 mt-2">and {location.region}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* LOCAL MARKET PULSE (Client Version) */}
            {(() => {
                const market = PARTNER_MARKETS.find(m =>
                    m.geography.town.toLowerCase() === location.name.split(',')[0].trim().toLowerCase()
                );

                if (!market || !market.localContext) return null;

                return (
                    <section className="py-20 bg-slate-50 border-y border-slate-200">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="grid md:grid-cols-2 gap-12 items-center">
                                <div className="order-2 md:order-1 relative h-96 rounded-2xl overflow-hidden shadow-xl bg-white border border-slate-100">
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <MapPin className="w-8 h-8" />
                                            </div>
                                            <p className="font-bold text-slate-400">Active Service Area</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-8 left-8 bg-white p-3 rounded-lg shadow-lg border border-slate-100 max-w-[200px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-bold text-slate-700">Live Coverage</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{location.name}</p>
                                    </div>
                                </div>

                                <div className="order-1 md:order-2">
                                    <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-bold mb-6">
                                        Local Operations
                                    </div>
                                    <h2 className="text-3xl font-bold font-heading text-slate-900 mb-6">
                                        Serving Facilities in {market.geography.town}
                                    </h2>
                                    <div className="space-y-6 text-lg text-slate-600">
                                        {market.localContext.corridor && (
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                                    <MapPin className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 mb-1">Active Routes</h3>
                                                    <p>Our teams are active along <strong className="text-slate-900">{market.localContext.corridor}</strong>.</p>
                                                </div>
                                            </div>
                                        )}

                                        {market.localContext.nearbyLandmarks && market.localContext.nearbyLandmarks.length > 0 && (
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                                    <MapPin className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 mb-1">Local Presence</h3>
                                                    <p>Trusted by businesses near <strong className="text-slate-900">{market.localContext.nearbyLandmarks[0]}</strong> and <strong className="text-slate-900">{market.localContext.nearbyLandmarks[1]}</strong>.</p>
                                                </div>
                                            </div>
                                        )}

                                        {market.localContext.painPoints && market.localContext.painPoints.length > 0 && (
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                                                    <Eye className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 mb-1">Problem Solvers</h3>
                                                    <p>Specialized in solving <strong className="text-slate-900">{market.localContext.painPoints[0]}</strong>.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            })()}

            <ValuePropsSection title={`Our Standard for ${location.name}`} />

            {/* Custom Manual FAQs to replace the invalid props usage */}
            <div className="max-w-4xl mx-auto px-4 py-20 bg-gray-50 rounded-xl my-12">
                <h3 className="text-2xl font-bold font-heading text-slate-900 mb-8 text-center">{service.name} FAQs</h3>
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h4 className="font-bold text-slate-900 mb-2">What areas do you serve?</h4>
                        <p className="text-slate-600">We actively serve {location.name} and the surrounding {location.region} area.</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h4 className="font-bold text-slate-900 mb-2">Do you provide insurance?</h4>
                        <p className="text-slate-600">Yes, all our partners are 100% bonded and insured, verified by our rigorous onboarding process.</p>
                    </div>
                </div>
            </div>

            {/* FAQs from Data */}
            <FAQ items={service.faqs || []} locationName={location.name} />

            <section className="py-16 bg-gray-50 border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Looking for {service.name} in {location.name}?
                    </h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Let us handle the dirty work so you can focus on growing your business in {location.state}.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Local Quote"
                        location={location.name}
                        className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    />
                </div>
            </section>

            <NearbyAreas
                serviceSlug={service.slug}
                serviceName={service.name}
                nearbyCities={location.nearbyCities || []}
                currentLocationName={location.name}
            />
        </div>
    );
}

// Logic to determine what the slug is
function parseSlug(slug: string) {
    // 1. Check if it's a Service Hub
    const service = seoData.services.find(s => s.slug === slug);
    if (service) {
        return { type: 'SERVICE', data: service };
    }

    // 2. Check if it's a Location Page
    // Pattern: [service]-in-[town]-[county]-[state]
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Reverse engineer: Try to find a service that matches the start of the string
    // This is safer than splitting by '-in-' if service slug has that pattern (unlikely but possible)
    const matchingService = seoData.services.find(s => slug.startsWith(s.slug + '-in-'));

    if (matchingService) {
        // Extract the location part
        const locationPart = slug.substring(matchingService.slug.length + 4); // remove "service-in-"

        // Now we need to find which location matches this slug part
        // We construct the slug for each location and check equality
        const matchingLocation = seoData.locations.find(loc => {
            const townSlug = slugify(loc.name.split(',')[0]);
            const countySlug = slugify(loc.region);
            // We can assume state is ny for now as per generator
            const constructedSlug = `${townSlug}-${countySlug}-ny`;
            return constructedSlug === locationPart;
        });

        if (matchingLocation) {
            return { type: 'LOCATION', data: { service: matchingService, location: matchingLocation } };
        }
    }

    return { type: 'NOT_FOUND', data: null };
}
