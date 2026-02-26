import Link from 'next/link';
import { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import seoData from '@/data/seo-data.json';
import { MapPin, Building2, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Location Directory | XIRI Facility Solutions',
    description: 'XIRI service areas in Nassau County, Long Island. Find facility management services in Great Neck, New Hyde Park, and surrounding communities.',
    alternates: { canonical: 'https://xiri.ai/directory/locations' },
};

export default function LocationDirectory() {
    const locations = seoData.locations as any[];

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'XIRI Service Areas', description: 'Facility management services across Nassau County, Long Island.', url: 'https://xiri.ai/directory/locations' }} />
            <Hero title="Our Service Areas" subtitle="Medical-grade facility management across Nassau County, NY. Local teams. Local precision." ctaText="Get a Free Site Audit" />

            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-8">
                        {locations.map((loc: any) => (
                            <div key={loc.slug} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                                {/* Embedded Map */}
                                <div className="h-56 w-full">
                                    <iframe
                                        title={`Map of ${loc.name}`}
                                        width="100%" height="100%" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${loc.latitude},${loc.longitude}&zoom=14`}
                                    />
                                </div>
                                {/* Location Info */}
                                <div className="p-6">
                                    <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-sky-600" /> {loc.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 mb-1">{loc.region} · Population {loc.population}</p>
                                    <p className="text-sm text-slate-600 mb-3">{loc.medicalDensity}</p>
                                    <p className="text-sm text-slate-500 mb-4">Key corridor: {loc.keyIntersection}</p>

                                    {/* LocalBusiness Schema */}
                                    <JsonLd data={{
                                        '@context': 'https://schema.org', '@type': 'LocalBusiness',
                                        name: 'XIRI Facility Solutions', description: `Facility management services in ${loc.name}`,
                                        address: { '@type': 'PostalAddress', addressLocality: loc.name.split(',')[0], addressRegion: loc.state, addressCountry: 'US' },
                                        geo: { '@type': 'GeoCoordinates', latitude: loc.latitude, longitude: loc.longitude },
                                        areaServed: { '@type': 'City', name: loc.name.split(',')[0] },
                                    }} />

                                    <div className="flex gap-3">
                                        {seoData.services.slice(0, 3).map((svc: any) => (
                                            <Link key={svc.slug} href={`/services/${svc.slug}/in/${loc.slug}`} className="text-xs text-sky-600 hover:text-sky-800 font-medium">
                                                {svc.name} →
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
