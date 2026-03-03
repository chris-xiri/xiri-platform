// All Nassau County, NY ZIP codes
// Includes standard, PO Box, and unique ZIP codes
export const ALPHA_ZIPS = [
    // Floral Park / Bellerose / Elmont
    "11001", "11002", "11003", "11005",
    // Great Neck
    "11020", "11021", "11022", "11023", "11024", "11025", "11026", "11027",
    // Manhasset
    "11030",
    // New Hyde Park
    "11040", "11041", "11042", "11043", "11044",
    // Port Washington / Glen Cove / Roslyn
    "11050", "11051",
    // Lawrence
    "11096",
    // Great Neck (additional)
    "11099",
    // Mineola
    "11501",
    // Albertson
    "11507",
    // Atlantic Beach
    "11509",
    // Baldwin
    "11510",
    // Carle Place
    "11514",
    // Cedarhurst
    "11516",
    // East Meadow
    "11518",
    // Hempstead / West Hempstead
    "11520",
    // Garden City
    "11530", "11535", "11536",
    // Glen Cove
    "11542",
    // Glen Head
    "11545",
    // Glen Oaks / Glenwood Landing
    "11547",
    // Greenvale
    "11548",
    // Uniondale
    "11549",
    // Hempstead
    "11550", "11551",
    // West Hempstead
    "11552",
    // Uniondale
    "11553",
    // East Meadow
    "11554", "11555", "11556",
    // Hewlett
    "11557",
    // Island Park
    "11558",
    // Lawrence
    "11559",
    // Locust Valley / Lattingtown / Bayville
    "11560",
    // Long Beach / Lido Beach
    "11561",
    // Lynbrook
    "11563",
    // Malverne
    "11565",
    // Merrick / North Merrick
    "11566",
    // Old Westbury
    "11568",
    // Point Lookout
    "11569",
    // Rockville Centre
    "11570", "11571",
    // Oceanside
    "11572",
    // Roosevelt
    "11575",
    // Roslyn / Roslyn Heights
    "11576", "11577",
    // Sea Cliff
    "11579",
    // Valley Stream
    "11580", "11581", "11582",
    // Westbury / Old Westbury
    "11590",
    // Oceanside (additional)
    "11592",
    // Williston Park
    "11596",
    // Westbury (additional)
    "11597",
    // Woodmere
    "11598",
    // Hempstead (additional)
    "11599",
    // Bellmore
    "11710",
    // Bethpage
    "11714",
    // East Norwich
    "11732",
    // Farmingdale
    "11735", "11736",
    // Hicksville
    "11753",
    // Levittown
    "11756",
    // Massapequa / Massapequa Park
    "11758", "11762",
    // Mill Neck
    "11765",
    // Oyster Bay
    "11771", "11773", "11774",
    // Seaford
    "11783",
    // Syosset
    "11791",
    // Wantagh
    "11793",
    // Woodbury / Jericho
    "11797",
    // Plainview
    "11801", "11802", "11803", "11804", "11815",
    // Hicksville (additional)
    "11819",
    // Jericho
    "11853", "11854", "11855",
    // Freeport
    "11520",
    // North Bellmore
    "11710",
    // Elmont
    "11003",
    // Franklin Square
    "11010",
    // Floral Park
    "11001",
    // South Floral Park
    "11001",
    // Salisbury
    "11554",
    // North Woodmere
    "11581",
    // Inwood
    "11096",
    // Bayville
    "11709",
];

// Deduplicate
const uniqueZips = [...new Set(ALPHA_ZIPS)];

export const isValidZip = (zip: string) => uniqueZips.includes(zip);
