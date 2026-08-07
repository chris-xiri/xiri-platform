import Link from 'next/link';
import { getStates, slugify } from '@/lib/location-utils';
import { Hero } from '@/components/Hero';

export const metadata = {
    title: 'Service Locations | Xiri Facility Solutions',
    description: 'Find commercial cleaning and facility management services near you. View our complete list of service areas and locations across the US.',
};

export default function LocationsStateHub() {
    const states = getStates();

    return (
        <div className="min-h-screen bg-white">
            <Hero
                title="Service Locations"
                subtitle="We provide commercial cleaning and facility management across the United States. Select your state below to see our local service areas."
                ctaText="Get a Free Quote"
            />
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {states.map((state) => (
                        <Link 
                            key={state} 
                            href={`/locations/${slugify(state)}`}
                            className="p-6 bg-gray-50 border border-gray-200 rounded-xl hover:bg-sky-50 hover:border-sky-300 transition-colors text-center font-bold text-gray-900"
                        >
                            {state.toUpperCase()}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
