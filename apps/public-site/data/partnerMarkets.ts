import { PartnerMarket } from "@xiri/shared";

// Core Nassau Hubs for Contractor Recruitment
const NASSAU_HUBS = [
    // North Shore
    { town: "Great Neck", corridor: "Northern Blvd / Medical Mile" },
    { town: "Manhasset", corridor: "Miracle Mile" },
    { town: "Port Washington", corridor: "Main Street Waterfront" },
    // Central
    { town: "Garden City", corridor: "Franklin Ave Financial District" },
    { town: "Mineola", corridor: "NYU Langone Medical Hub" },
    { town: "Hempstead", corridor: "Fulton Ave Transport Hub" },
    { town: "Westbury", corridor: "Old Country Rd Retail" },
    // South Shore
    { town: "Rockville Centre", corridor: "Sunrise Highway" },
    { town: "Freeport", corridor: "Nautical Mile" },
    { town: "Bellmore", corridor: "Sunrise Highway Commercial" },
    // East / Inland
    { town: "Hicksville", corridor: "Broadway Route 107" },
    { town: "Levittown", corridor: "Hempstead Turnpike" },
    { town: "Plainview", corridor: "Old Country Rd Corporate Parks" },
    { town: "Farmingdale", corridor: "Route 110 Industrial" }
];

export const PARTNER_MARKETS: PartnerMarket[] = NASSAU_HUBS.map(hub => ({
    slug: `janitorial-in-${hub.town.toLowerCase().replace(/ /g, '-')}-nassau-ny`,
    geography: { town: hub.town, county: "nassau", state: "ny" },
    trade: "janitorial",
    localContext: {
        corridor: hub.corridor,
        nearbyLandmarks: [], // Simplified for bulk generation
        painPoints: ["Staffing reliability", "Supply chain costs"]
    },
    translations: {
        es: {
            metaTitle: `Contratos de Limpieza en ${hub.town} | Red Xiri`,
            description: `Busque contratos de limpieza comercial en ${hub.town}, Nassau County. Únase a nuestra red.`,
            hero: {
                headline: `Contratos de Limpieza en ${hub.town}`,
                subheadline: `Buscamos compañías de limpieza confiables en ${hub.town}. Nosotros vendemos, usted limpia.`
            },
            localContext: {
                corridor: hub.corridor,
                painPoints: ["Confiabilidad del personal", "Costos de suministros"]
            }
        }
    }
}));


export function getMarketBySlug(slug: string): PartnerMarket | undefined {
    return PARTNER_MARKETS.find(m => m.slug === slug);
}
