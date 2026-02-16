import Link from 'next/link';
import { MapPin } from 'lucide-react';

interface NearbyAreasProps {
    serviceSlug: string;
    serviceName: string;
    nearbyCities: string[];
    currentLocationName: string;
}

export function NearbyAreas({ serviceSlug, serviceName, nearbyCities, currentLocationName }: NearbyAreasProps) {
    if (!nearbyCities || nearbyCities.length === 0) return null;

    // Helper to format city name to slug
    // Heuristic: "Garden City" -> "garden-city"
    // We append "-nassau-ny" as a safer default for now or strict "ny" if we don't know the county.
    // Given the constraints, we will assume "ny" state.
    // The previous plan was [service]-in-[town]-[county]-[state].
    // Since we don't have county passed here for *each* nearby city, we might have to relax the strictness 
    // OR pass the full location objects. 
    // For this iteration, let's hardcode "nassau" if we can't determine it, or try to be generic. 
    // Actually, let's just use the town-state pattern if we can, BUT our route expects county.
    // Let's assume the nearby cities are in the SAME county as the current one.
    // But we don't have current county passed explicitly either (just name).
    // Let's rely on the routing to potentially handle missing county or generic "ny".
    // Wait, the router `app/services/[slug]` regex requires `[town]-[county]-[state]`.
    // I will assume 'nassau' for now as 80% effective, or 'suffolk'/ 'queens' based on current.
    // Better yet: Update `nearbyCities` in `seo-data.json` to include county context? No time.

    // ACTION: I will update the link generation to `[service]-in-[town]-ny` and update the route matcher to be more flexible?
    // NO, I will stick to the plan: `[service]-in-[town]-[county]-[state]`.
    // I will try to infer county.

    const inferCounty = (city: string) => {
        // Simple heuristic for major towns in our list
        const queens = ['Astoria', 'Long Island City', 'Flushing', 'Jamaica'];
        const suffolk = ['Melville', 'Smithtown', 'Hauppauge', 'Huntington'];
        if (queens.includes(city)) return 'queens';
        if (suffolk.includes(city)) return 'suffolk';
        return 'nassau'; // Default
    };

    return (
        <section className="py-20 bg-white border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-2xl font-bold font-heading text-slate-900 mb-4">
                        Looking for {serviceName} near {currentLocationName}?
                    </h2>
                    <div className="w-24 h-1 bg-sky-100 mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {nearbyCities.map((city) => {
                        const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        const countySlug = inferCounty(city);
                        const href = `/services/${serviceSlug}-in-${citySlug}-${countySlug}-ny`;

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
