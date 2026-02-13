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
import { SeoService } from '@xiri/shared';



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
        slug: string; // Changed from 'service' to 'slug'
        location: string;
    }>;
};

// Generate all Service + Location combinations
export async function generateStaticParams() {
    const params = [];
    for (const service of seoData.services) {
        for (const location of seoData.locations) {
            params.push({
                slug: service.slug,
                location: location.slug,
            });
        }
    }
    return params;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug: serviceSlug, location: locationSlug } = await params;

    // Validate
    const service = seoData.services.find((s) => s.slug === serviceSlug) as SeoService;
    const location = seoData.locations.find((l) => l.slug === locationSlug);

    if (!service || !location) return {};

    return {
        title: `${service.name} in ${location.name} | XIRI`,
        description: `Professional ${service.name} in ${location.name}. ${service.shortDescription}`,
    };
}

export default async function ServiceLocationPage({ params }: Props) {
    const { slug: serviceSlug, location: locationSlug } = await params;

    // Validate
    const service = seoData.services.find((s) => s.slug === serviceSlug) as SeoService;
    const location = seoData.locations.find((l) => l.slug === locationSlug);

    if (!service || !location) {
        notFound();
    }

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
        url: `https://www.xiri.com/${service.slug}/${location.slug}`,
        department: {
            '@type': 'ProfessionalService',
            name: service.name,
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={jsonLd} />
            {/* Tracking */}
            <ServiceTracker service={serviceSlug} location={locationSlug} />

            {/* Dynamic Hero */}
            <Hero
                title={
                    <>
                        {service.name} in <span className="text-blue-600">{location.name}</span>
                    </>
                }
                subtitle={`${service.shortDescription} Proudly serving medical facilities near ${location.landmarks?.join(', ') || location.region}.`}
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
                                {service.benefits.map((benefit, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="text-green-500 mr-2">✓</span>
                                        <span className="text-gray-700 font-medium">{benefit}</span>
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

            {/* Reused Value Props */}
            <ValuePropsSection title={`Our Standard for ${location.name}`} />

            {/* FAQs */}
            <FAQ items={service.faqs || []} locationName={location.name} />

            {/* CTA Section */}
            <section className="py-16 bg-gray-50 border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Looking for {service.name} in {location.name}?
                    </h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Let us handle the dirty work so you can focus on growing your business in {location.state}.
                    </p>
                    <CTAButton
                        href="/medical-offices#survey"
                        text="Get Your Local Quote"
                        location={location.name}
                        className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    />
                </div>
            </section>

            {/* Nearby Areas Interlinking */}
            <NearbyAreas
                serviceSlug={service.slug}
                serviceName={service.name}
                nearbyCities={location.nearbyCities || []}
                currentLocationName={location.name}
            />
        </div>
    );
}
