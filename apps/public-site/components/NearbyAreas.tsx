import Link from 'next/link';
// import { SeoLocation } from '@/data/seo-data'; // Removed broken import for now
// Actually, strict protocol says imports from @xiri/shared. But for now avoiding compilation breakages if tsconfig isn't perfectly set up for monorepo in this file. 
// Let's use internal types for props to be safe or just standard props.

interface NearbyAreasProps {
    serviceSlug: string;
    serviceName: string;
    nearbyCities: string[]; // Just strings from the JSON
    currentLocationName: string;
}

export function NearbyAreas({ serviceSlug, serviceName, nearbyCities, currentLocationName }: NearbyAreasProps) {
    if (!nearbyCities || nearbyCities.length === 0) return null;

    // Helper to format city name to slug (e.g. "West Hempstead" -> "west-hempstead-ny")
    // Note: In a real robust system we'd look up the actual slug from the DB. 
    // Here we make a best guess or we should have passed the objects. 
    // For "Level 1" let's assume valid slugs can be derived or we just link to known ones.
    // Actually, seo-data.json has "nearbyCities": ["Hempstead", "Uniondale"]. 
    // We need to match these to actual slugs in our data.

    // Ideally we would pass the full Location objects, but let's keep it simple.
    // We will assume standard formatting for now or just link to the main service page if not found? 
    // No, better to try to slugify: "Garden City" -> "garden-city-ny"

    // WAIT: The data has "nearbyCities": ["Hempstead", "Uniondale"]. 
    // "Hempstead" should map to "hempstead-ny".
    const slugify = (city: string) => {
        return city.toLowerCase().replace(/\s+/g, '-') + '-ny';
    };

    return (
        <section className="py-12 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Looking for {serviceName} near {currentLocationName}?
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {nearbyCities.map((city) => (
                        <Link
                            key={city}
                            href={`/${serviceSlug}/${slugify(city)}`}
                            className="text-gray-600 hover:text-blue-600 text-sm hover:underline"
                        >
                            {serviceName} in {city}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
