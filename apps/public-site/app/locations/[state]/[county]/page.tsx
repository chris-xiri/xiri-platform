import Link from 'next/link';
import { getTownsByCounty, slugify, LocationData } from '@/lib/location-utils';
import { Hero } from '@/components/Hero';
import { notFound } from 'next/navigation';

type Props = {
    params: Promise<{
        state: string;
        county: string;
    }>;
};

export async function generateMetadata({ params }: Props) {
    const { state, county } = await params;
    // Format county name properly from slug
    const countyName = county.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return {
        title: `Commercial Cleaning Services in ${countyName}, ${state.toUpperCase()} | Xiri`,
        description: `Local commercial cleaning and facility management services across ${countyName}, ${state.toUpperCase()}. Explore our towns and get a customized quote.`,
    };
}

export default async function LocationsTownHub({ params }: Props) {
    const { state, county } = await params;
    const towns = getTownsByCounty(state, county);
    
    if (towns.length === 0) {
        notFound();
    }
    
    const countyName = towns[0].region;

    return (
        <div className="min-h-screen bg-white">
            <Hero
                title={`Service Areas in ${countyName}, ${state.toUpperCase()}`}
                subtitle={`We provide top-rated commercial cleaning, janitorial, and specialized facility management across ${countyName}.`}
                ctaText="Get a Free Quote"
            />
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Towns & Cities We Serve</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {towns.map((loc: LocationData) => (
                        <Link 
                            key={loc.slug} 
                            href={`/locations/${state}/${county}/${slugify(loc.name.split(',')[0])}`}
                            className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-sky-300 transition-all text-center text-gray-800 font-medium"
                        >
                            {loc.name.split(',')[0]}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
