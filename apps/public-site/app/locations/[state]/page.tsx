import Link from 'next/link';
import { getCountiesByState, slugify } from '@/lib/location-utils';
import { Hero } from '@/components/Hero';
import { notFound } from 'next/navigation';

type Props = {
    params: Promise<{
        state: string;
    }>;
};

export async function generateMetadata({ params }: Props) {
    const { state } = await params;
    return {
        title: `Commercial Cleaning & Facility Management in ${state.toUpperCase()} | Xiri`,
        description: `Find expert commercial cleaning and facility management services in ${state.toUpperCase()}. Explore our service counties and get a free quote.`,
    };
}

export default async function LocationsCountyHub({ params }: Props) {
    const { state } = await params;
    const counties = getCountiesByState(state);

    if (counties.length === 0) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-white">
            <Hero
                title={`Service Areas in ${state.toUpperCase()}`}
                subtitle={`Browse our facility management and commercial cleaning coverage areas in ${state.toUpperCase()}.`}
                ctaText="Get a Free Quote"
            />
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Counties We Serve</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {counties.map((county) => (
                        <Link 
                            key={county} 
                            href={`/locations/${state}/${slugify(county)}`}
                            className="p-6 bg-gray-50 border border-gray-200 rounded-xl hover:bg-sky-50 hover:border-sky-300 transition-colors text-lg font-bold text-gray-900 flex justify-between items-center"
                        >
                            <span>{county}</span>
                            <span className="text-sky-600">→</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
