import { PartnerMarket } from "@xiri/shared";

// All Nassau County towns, villages, hamlets, and cities
const NASSAU_HUBS: { town: string; corridor: string }[] = [
    // ── Cities ──
    { town: "Glen Cove", corridor: "Glen Cove Ave Downtown" },
    { town: "Long Beach", corridor: "Park Ave Boardwalk District" },

    // ── North Shore ──
    { town: "Great Neck", corridor: "Northern Blvd / Medical Mile" },
    { town: "Great Neck Plaza", corridor: "Middle Neck Rd Village Center" },
    { town: "Manhasset", corridor: "Miracle Mile / Plandome Rd" },
    { town: "Port Washington", corridor: "Main Street Waterfront" },
    { town: "Roslyn", corridor: "Old Northern Blvd Village" },
    { town: "Roslyn Heights", corridor: "Warner Ave Commercial" },
    { town: "Greenvale", corridor: "Northern Blvd Corridor" },
    { town: "Glen Head", corridor: "Glen Head Rd / Glen Cove Rd" },
    { town: "Sea Cliff", corridor: "Sea Cliff Ave Village" },
    { town: "Bayville", corridor: "Bayville Ave Waterfront" },
    { town: "Locust Valley", corridor: "Birch Hill Rd / Forest Ave" },
    { town: "Mill Neck", corridor: "Oyster Bay Rd" },
    { town: "Oyster Bay", corridor: "South Street Historic District" },
    { town: "East Norwich", corridor: "Oyster Bay Rd / Route 106" },
    { town: "Lattingtown", corridor: "Lattingtown Rd" },
    { town: "Muttontown", corridor: "Route 106 / Jericho Tpke" },
    { town: "Brookville", corridor: "Cedar Swamp Rd" },
    { town: "Old Brookville", corridor: "Chicken Valley Rd" },
    { town: "Upper Brookville", corridor: "Wolver Hollow Rd" },
    { town: "Matinecock", corridor: "Duck Pond Rd" },
    { town: "Cove Neck", corridor: "Cove Neck Rd" },
    { town: "Centre Island", corridor: "Centre Island Rd" },
    { town: "Sands Point", corridor: "Sands Point Rd / Port Washington Blvd" },
    { town: "Kings Point", corridor: "Redbrook Rd" },
    { town: "Thomaston", corridor: "Northern Blvd" },
    { town: "Plandome", corridor: "Plandome Rd" },
    { town: "Plandome Heights", corridor: "Plandome Rd" },
    { town: "Plandome Manor", corridor: "Stonytown Rd" },
    { town: "Flower Hill", corridor: "Port Washington Blvd" },
    { town: "Munsey Park", corridor: "Munsey Park Rd" },
    { town: "North Hills", corridor: "Northern Blvd / Shelter Rock Rd" },
    { town: "Lake Success", corridor: "Marcus Ave / New Hyde Park Rd" },
    { town: "Saddle Rock", corridor: "Bayview Ave" },
    { town: "Russell Gardens", corridor: "Arrandale Ave" },

    // ── Central / Hempstead ──
    { town: "Garden City", corridor: "Franklin Ave Financial District" },
    { town: "Mineola", corridor: "NYU Langone Medical Hub" },
    { town: "Hempstead", corridor: "Fulton Ave Transport Hub" },
    { town: "West Hempstead", corridor: "Hempstead Tpke" },
    { town: "Westbury", corridor: "Old Country Rd / Post Ave" },
    { town: "Old Westbury", corridor: "Jericho Tpke / Glen Cove Rd" },
    { town: "Carle Place", corridor: "Old Country Rd / Glen Cove Rd" },
    { town: "New Hyde Park", corridor: "Lakeville Rd / Hillside Ave" },
    { town: "Floral Park", corridor: "Tulip Ave / Jericho Tpke" },
    { town: "Elmont", corridor: "Hempstead Tpke / Elmont Rd" },
    { town: "Franklin Square", corridor: "Hempstead Tpke / Franklin Ave" },
    { town: "Uniondale", corridor: "Hempstead Tpke / Front St" },
    { town: "East Meadow", corridor: "Hempstead Tpke / Newbridge Rd" },
    { town: "Roosevelt", corridor: "Nassau Rd / Babylon Tpke" },
    { town: "Albertson", corridor: "Willis Ave / Roslyn Rd" },
    { town: "Williston Park", corridor: "Hillside Ave" },
    { town: "East Williston", corridor: "Hillside Ave" },
    { town: "Herricks", corridor: "Herricks Rd / Shelter Rock Rd" },
    { town: "Salisbury", corridor: "Old Country Rd" },
    { town: "Stewart Manor", corridor: "Stewart Ave" },
    { town: "Garden City South", corridor: "Nassau Blvd" },
    { town: "Garden City Park", corridor: "Jericho Tpke / Herricks Rd" },

    // ── East / Oyster Bay ──
    { town: "Hicksville", corridor: "Broadway Route 107" },
    { town: "Levittown", corridor: "Hempstead Tpke" },
    { town: "Plainview", corridor: "Old Country Rd Corporate Parks" },
    { town: "Old Bethpage", corridor: "Round Swamp Rd" },
    { town: "Bethpage", corridor: "Broadway / Stewart Ave" },
    { town: "Farmingdale", corridor: "Route 110 Industrial" },
    { town: "Syosset", corridor: "Jericho Tpke / Cold Spring Rd" },
    { town: "Jericho", corridor: "Jericho Tpke / Route 106" },
    { town: "Woodbury", corridor: "Jericho Tpke / Woodbury Rd" },

    // ── South Shore ──
    { town: "Rockville Centre", corridor: "Sunrise Highway / Village Ave" },
    { town: "Oceanside", corridor: "Long Beach Rd / Atlantic Ave" },
    { town: "Freeport", corridor: "Nautical Mile / Sunrise Highway" },
    { town: "Baldwin", corridor: "Grand Ave / Sunrise Highway" },
    { town: "Merrick", corridor: "Merrick Rd / Sunrise Highway" },
    { town: "Bellmore", corridor: "Sunrise Highway / Bedford Ave" },
    { town: "North Bellmore", corridor: "Bellmore Ave / Newbridge Rd" },
    { town: "Wantagh", corridor: "Wantagh Ave / Sunrise Highway" },
    { town: "Seaford", corridor: "Sunrise Highway / Seaford Oyster Bay Expy" },
    { town: "Massapequa", corridor: "Sunrise Highway / Broadway" },
    { town: "Massapequa Park", corridor: "Park Blvd / Sunrise Highway" },
    { town: "Lynbrook", corridor: "Sunrise Highway / Atlantic Ave" },
    { town: "Malverne", corridor: "Hempstead Ave" },
    { town: "Valley Stream", corridor: "Sunrise Highway / Rockaway Ave" },
    { town: "Island Park", corridor: "Long Beach Rd" },
    { town: "Point Lookout", corridor: "Lido Blvd" },

    // ── Five Towns / South ──
    { town: "Lawrence", corridor: "Central Ave / Broadway" },
    { town: "Cedarhurst", corridor: "Central Ave Village" },
    { town: "Woodmere", corridor: "Broadway / Peninsula Blvd" },
    { town: "Hewlett", corridor: "Broadway / Franklin Ave" },
    { town: "Inwood", corridor: "Doughty Blvd / Bayview Ave" },
    { town: "Atlantic Beach", corridor: "Park St Oceanfront" },
    { town: "East Rockaway", corridor: "Main St / Atlantic Ave" },
    { town: "North Woodmere", corridor: "Hungry Harbor Rd" },
    { town: "Lido Beach", corridor: "Lido Blvd" },
];

export const PARTNER_MARKETS: PartnerMarket[] = NASSAU_HUBS.map(hub => ({
    slug: `janitorial-in-${hub.town.toLowerCase().replace(/ /g, '-')}-nassau-ny`,
    geography: { town: hub.town, county: "nassau", state: "ny" },
    trade: "janitorial",
    localContext: {
        corridor: hub.corridor,
        nearbyLandmarks: [],
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
