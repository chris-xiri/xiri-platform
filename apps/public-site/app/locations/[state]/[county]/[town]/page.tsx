import Link from 'next/link';
import { getLocationBySlugs, slugify } from '@/lib/location-utils';
import { Hero } from '@/components/Hero';
import { notFound } from 'next/navigation';
import seoData from '@/data/seo-data.json';

type Props = {
    params: Promise<{
        state: string;
        county: string;
        town: string;
    }>;
};

export async function generateMetadata({ params }: Props) {
    const { state, county, town } = await params;
    const location = getLocationBySlugs(state, county, town);
    if (!location) return {};

    const townName = location.name.split(',')[0];
    return {
        title: `Commercial Cleaning & Facility Services in ${townName}, ${state.toUpperCase()} | Xiri`,
        description: `Looking for top-rated commercial cleaning in ${townName}? Xiri Facility Solutions provides expert janitorial, floor care, and facility maintenance in ${location.region}.`,
    };
}

export default async function LocationsServiceHub({ params }: Props) {
    const { state, county, town } = await params;
    const location = getLocationBySlugs(state, county, town);
    
    if (!location) {
        notFound();
    }
    
    const townName = location.name.split(',')[0];
    // Filter for top lead services to display prominently
    const LEAD_SERVICES = ['commercial-cleaning', 'janitorial-services', 'medical-office-cleaning', 'floor-care', 'office-cleaning'];
    const services = seoData.services.filter(s => LEAD_SERVICES.includes(s.slug));

    return (
        <div className="min-h-screen bg-white">
            <Hero
                title={`Commercial Cleaning in ${townName}, ${state.toUpperCase()}`}
                subtitle={location.localInsight || `Comprehensive facility management and cleaning services trusted by businesses across ${location.region}.`}
                ctaText="Get a Free Quote"
            />
            
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <div className="mb-12 text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Services Available in {townName}</h2>
                    <p className="text-gray-600">
                        From daily janitorial routines to specialized compliance cleaning, we match your facility with vetted, $1M-insured contractors.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service: any) => (
                        <Link 
                            key={service.slug} 
                            href={`/locations/${state}/${county}/${town}/${service.slug}`}
                            className="flex flex-col p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-sky-300 transition-all group"
                        >
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-sky-700 transition-colors mb-2">
                                {service.name}
                            </h3>
                            <p className="text-sm text-gray-500 mb-4 flex-grow">
                                {service.shortDescription}
                            </p>
                            <span className="text-sky-600 font-medium text-sm flex items-center">
                                View Service Details <span className="ml-1">→</span>
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
            
            {location.landmarks && location.landmarks.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-200 py-12">
                    <div className="max-w-4xl mx-auto px-4 text-center">
                        <h3 className="font-semibold text-gray-900 mb-2">Proudly Serving Near</h3>
                        <p className="text-gray-600 text-sm">
                            {location.landmarks.join(' • ')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
