import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { getAllLocations, slugify } from '@/lib/location-utils';

interface NearbyAreasProps {
    serviceSlug: string;
    serviceName: string;
    nearbyCities: string[];
    currentLocationName: string;
    baseRoute?: string;
}

export function NearbyAreas({ serviceSlug, serviceName, nearbyCities, currentLocationName }: NearbyAreasProps) {
    if (!nearbyCities || nearbyCities.length === 0) return null;

    const allLocations = getAllLocations();

    const resolveCanonicalHref = (city: string) => {
        const cityClean = city.split(',')[0].trim();
        const citySlug = slugify(cityClean);

        // 1. Exact match in seoData.locations
        const matchedLoc = allLocations.find(loc => {
            const locTownSlug = slugify(loc.name.split(',')[0]);
            return locTownSlug === citySlug;
        });

        if (matchedLoc) {
            const stateSlug = slugify(matchedLoc.state);
            const countySlug = slugify(matchedLoc.region);
            const townSlug = slugify(matchedLoc.name.split(',')[0]);
            return `/locations/${stateSlug}/${countySlug}/${townSlug}/${serviceSlug}`;
        }

        // 2. Fallback county inference for NY towns not yet in seoData.locations
        const queens = ['astoria', 'long-island-city', 'flushing', 'jamaica', 'forest-hills', 'bayside', 'jackson-heights', 'rego-park', 'elmhurst', 'whitestone'];
        const suffolk = ['melville', 'smithtown', 'hauppauge', 'huntington', 'babylon', 'bay-shore', 'islip', 'commack', 'patchogue', 'ronkonkoma', 'stony-brook'];
        let countySlug = 'nassau-county';
        if (queens.includes(citySlug)) countySlug = 'queens';
        else if (suffolk.includes(citySlug)) countySlug = 'suffolk-county';

        return `/locations/ny/${countySlug}/${citySlug}/${serviceSlug}`;
    };

    return (
        <section className="py-20 bg-white border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-2xl font-bold font-heading text-slate-900 mb-4">
                        Looking for {serviceName} Cleaning near {currentLocationName}?
                    </h2>
                    <div className="w-24 h-1 bg-sky-100 mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {nearbyCities.map((city) => {
                        const href = resolveCanonicalHref(city);

                        return (
                            <Link
                                key={city}
                                href={href}
                                className="group flex items-center justify-center px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50 transition-all"
                            >
                                <MapPin className="w-4 h-4 text-slate-400 mr-2 group-hover:text-sky-500" />
                                <span className="text-slate-600 font-medium text-sm group-hover:text-sky-700">
                                    {city}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
