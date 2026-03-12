/**
 * Market Data Generator for xiriOS pSEO pages
 * 
 * Pulls real data from:
 * - U.S. Census Bureau County Business Patterns (CBP):
 *     NAICS 561720 (Janitorial Services) — by state
 *     NAICS 5311   (Lessors of Real Estate — office buildings) — by metro
 *     NAICS 6211   (Offices of Physicians — medical facilities) — by metro
 *     NAICS 6111   (Elementary & Secondary Schools) — by metro
 * - U.S. Bureau of Labor Statistics (BLS) OEWS — SOC 37-2011 (Janitors & Cleaners)
 * 
 * Run: npx tsx scripts/generate-market-data.ts
 * Schedule: GitHub Actions workflow runs annually (see .github/workflows/refresh-market-data.yml)
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CBP_YEAR = "2022"; // Latest CBP data year
const BLS_YEAR = "May 2024"; // Latest BLS OEWS release

// FIPS codes for all 50 states + DC
const STATE_FIPS: Record<string, string> = {
    AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
    DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
    IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
    MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
    NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
    OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
    TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
    WI: "55", WY: "56",
};

// State minimum wages (as of Jan 2025)
const STATE_MIN_WAGES: Record<string, number> = {
    AL: 7.25, AK: 11.73, AZ: 14.70, AR: 11.00, CA: 16.50, CO: 14.81, CT: 16.35,
    DE: 13.25, DC: 17.50, FL: 13.00, GA: 7.25, HI: 14.00, ID: 7.25, IL: 14.00,
    IN: 7.25, IA: 7.25, KS: 7.25, KY: 7.25, LA: 7.25, ME: 14.15, MD: 15.00,
    MA: 15.00, MI: 10.56, MN: 11.13, MS: 7.25, MO: 12.30, MT: 10.55, NE: 12.00,
    NV: 12.00, NH: 7.25, NJ: 15.49, NM: 12.00, NY: 15.00, NC: 7.25, ND: 7.25,
    OH: 10.45, OK: 7.25, OR: 14.70, PA: 7.25, RI: 14.00, SC: 7.25, SD: 11.20,
    TN: 7.25, TX: 7.25, UT: 7.25, VT: 14.01, VA: 12.41, WA: 16.66, WV: 8.75,
    WI: 7.25, WY: 7.25,
};

// BLS OEWS MSA codes → median hourly wage for SOC 37-2011 (May 2024)
// Source: https://www.bls.gov/oes/current/oes372011.htm
const MSA_DATA: Record<string, { name: string; medianWage: number }> = {
    "35620": { name: "New York-Newark-Jersey City", medianWage: 21.83 },
    "31080": { name: "Los Angeles-Long Beach-Anaheim", medianWage: 19.42 },
    "16980": { name: "Chicago-Naperville-Elgin", medianWage: 17.67 },
    "26420": { name: "Houston-The Woodlands-Sugar Land", medianWage: 14.09 },
    "38060": { name: "Phoenix-Mesa-Chandler", medianWage: 16.72 },
    "37980": { name: "Philadelphia-Camden-Wilmington", medianWage: 17.33 },
    "41700": { name: "San Antonio-New Braunfels", medianWage: 13.68 },
    "41740": { name: "San Diego-Chula Vista-Carlsbad", medianWage: 18.96 },
    "19100": { name: "Dallas-Fort Worth-Arlington", medianWage: 15.36 },
    "12420": { name: "Austin-Round Rock-Georgetown", medianWage: 14.89 },
    "27260": { name: "Jacksonville", medianWage: 15.48 },
    "41940": { name: "San Jose-Sunnyvale-Santa Clara", medianWage: 21.26 },
    "18140": { name: "Columbus", medianWage: 15.85 },
    "16740": { name: "Charlotte-Concord-Gastonia", medianWage: 15.20 },
    "26900": { name: "Indianapolis-Carmel-Anderson", medianWage: 15.70 },
    "41860": { name: "San Francisco-Oakland-Berkeley", medianWage: 21.97 },
    "42660": { name: "Seattle-Tacoma-Bellevue", medianWage: 21.41 },
    "19740": { name: "Denver-Aurora-Lakewood", medianWage: 18.10 },
    "47900": { name: "Washington-Arlington-Alexandria", medianWage: 17.48 },
    "34980": { name: "Nashville-Davidson-Murfreesboro-Franklin", medianWage: 15.12 },
    "36420": { name: "Oklahoma City", medianWage: 14.29 },
    "21340": { name: "El Paso", medianWage: 12.61 },
    "14460": { name: "Boston-Cambridge-Newton", medianWage: 19.86 },
    "38900": { name: "Portland-Vancouver-Hillsboro", medianWage: 18.35 },
    "29820": { name: "Las Vegas-Henderson-Paradise", medianWage: 17.02 },
    "32820": { name: "Memphis", medianWage: 14.42 },
    "31140": { name: "Louisville/Jefferson County", medianWage: 15.38 },
    "12580": { name: "Baltimore-Columbia-Towson", medianWage: 16.28 },
    "33340": { name: "Milwaukee-Waukesha", medianWage: 16.52 },
    "10740": { name: "Albuquerque", medianWage: 14.73 },
    "46060": { name: "Tucson", medianWage: 15.28 },
    "23420": { name: "Fresno", medianWage: 17.34 },
    "40900": { name: "Sacramento-Roseville-Folsom", medianWage: 18.18 },
    "28140": { name: "Kansas City", medianWage: 15.82 },
    "12060": { name: "Atlanta-Sandy Springs-Alpharetta", medianWage: 15.15 },
    "36540": { name: "Omaha-Council Bluffs", medianWage: 15.43 },
    "17820": { name: "Colorado Springs", medianWage: 16.88 },
    "39580": { name: "Raleigh-Cary", medianWage: 15.04 },
    "33100": { name: "Miami-Fort Lauderdale-Pompano Beach", medianWage: 15.83 },
    "33460": { name: "Minneapolis-St. Paul-Bloomington", medianWage: 17.95 },
    "45300": { name: "Tampa-St. Petersburg-Clearwater", medianWage: 15.59 },
    "46140": { name: "Tulsa", medianWage: 14.15 },
    "35380": { name: "New Orleans-Metairie", medianWage: 13.95 },
    "48620": { name: "Wichita", medianWage: 14.47 },
    "17460": { name: "Cleveland-Elyria", medianWage: 14.95 },
    "13820": { name: "Birmingham-Hoover", medianWage: 13.80 },
    "40140": { name: "Riverside-San Bernardino-Ontario", medianWage: 18.32 },
    "15980": { name: "Cape Coral-Fort Myers", medianWage: 15.90 },
    "36740": { name: "Orlando-Kissimmee-Sanford", medianWage: 15.29 },
    "41180": { name: "St. Louis", medianWage: 15.53 },
    "38300": { name: "Pittsburgh", medianWage: 15.22 },
    "40060": { name: "Richmond", medianWage: 14.89 },
    "41620": { name: "Salt Lake City", medianWage: 16.12 },
    "24340": { name: "Grand Rapids-Kentwood", medianWage: 15.68 },
    "26620": { name: "Honolulu", medianWage: 18.71 },
    "30780": { name: "Little Rock-North Little Rock-Conway", medianWage: 13.56 },
    "17900": { name: "Columbia", medianWage: 14.10 },
    "16700": { name: "Charleston-North Charleston", medianWage: 14.85 },
    "47260": { name: "Virginia Beach-Norfolk-Newport News", medianWage: 14.62 },
    "24860": { name: "Greenville-Anderson", medianWage: 14.55 },
    "39300": { name: "Providence-Warwick", medianWage: 16.45 },
    "30460": { name: "Lexington-Fayette", medianWage: 14.80 },
    "17140": { name: "Cincinnati", medianWage: 15.42 },
    "11260": { name: "Anchorage", medianWage: 17.85 },
    "24660": { name: "Greensboro-High Point", medianWage: 14.38 },
    "30140": { name: "Lancaster", medianWage: 15.10 },
    "12940": { name: "Baton Rouge", medianWage: 13.62 },
    "15380": { name: "Buffalo-Cheektowaga", medianWage: 17.02 },
    "10580": { name: "Albany-Schenectady-Troy", medianWage: 17.18 },
    "49340": { name: "Worcester", medianWage: 18.20 },
    "16860": { name: "Chattanooga", medianWage: 14.05 },
    "44140": { name: "Springfield", medianWage: 16.85 },
    "19820": { name: "Detroit-Warren-Dearborn", medianWage: 16.28 },
    "14260": { name: "Boise City", medianWage: 15.42 },
    "18580": { name: "Corpus Christi", medianWage: 13.35 },
    "13140": { name: "Beaumont-Port Arthur", medianWage: 13.18 },
    "34820": { name: "Myrtle Beach-Conway-North Myrtle Beach", medianWage: 14.22 },
    "29460": { name: "Lakeland-Winter Haven", medianWage: 14.85 },
    "37100": { name: "Oxnard-Thousand Oaks-Ventura", medianWage: 18.55 },
    "12260": { name: "Augusta-Richmond County", medianWage: 13.52 },
    "40380": { name: "Rochester", medianWage: 16.78 },
    "44700": { name: "Stockton", medianWage: 17.90 },
    "34940": { name: "Naples-Marco Island", medianWage: 16.10 },
    "35300": { name: "New Haven-Milford", medianWage: 17.42 },
    "25540": { name: "Hartford-East Hartford-Middletown", medianWage: 17.55 },
    "14860": { name: "Bridgeport-Stamford-Norwalk", medianWage: 18.92 },
    "22180": { name: "Fayetteville", medianWage: 13.90 },
    "10420": { name: "Akron", medianWage: 14.65 },
    "19380": { name: "Dayton-Kettering", medianWage: 14.72 },
    "46520": { name: "Urban Honolulu", medianWage: 18.71 },
    "28940": { name: "Knoxville", medianWage: 14.18 },
    "31180": { name: "Lubbock", medianWage: 12.95 },
    "15180": { name: "Brownsville-Harlingen", medianWage: 11.85 },
    "10900": { name: "Allentown-Bethlehem-Easton", medianWage: 16.15 },
    "30700": { name: "Lincoln", medianWage: 15.18 },
    "42540": { name: "Scranton-Wilkes-Barre", medianWage: 15.05 },
};

// MSA → associated state codes (for filtering metros by state in the calculator)
const MSA_STATES: Record<string, string[]> = {
    "10420": ["OH"], "10580": ["NY"], "10740": ["NM"],
    "10900": ["PA", "NJ"], "11260": ["AK"], "12060": ["GA"],
    "12260": ["GA", "SC"], "12420": ["TX"], "12580": ["MD"],
    "12940": ["LA"], "13140": ["TX"], "13820": ["AL"],
    "14260": ["ID"], "14460": ["MA", "NH"], "14860": ["CT"],
    "15180": ["TX"], "15380": ["NY"], "15980": ["FL"],
    "16700": ["SC"], "16740": ["NC", "SC"], "16860": ["TN", "GA"],
    "16980": ["IL", "IN", "WI"], "17140": ["OH", "KY", "IN"],
    "17460": ["OH"], "17820": ["CO"], "17900": ["SC"],
    "18140": ["OH"], "18580": ["TX"], "19100": ["TX"],
    "19380": ["OH"], "19740": ["CO"], "19820": ["MI"],
    "21340": ["TX"], "22180": ["NC"], "23420": ["CA"],
    "24340": ["MI"], "24660": ["NC"], "24860": ["SC"],
    "25540": ["CT"], "26420": ["TX"], "26620": ["HI"],
    "26900": ["IN"], "27260": ["FL"], "28140": ["MO", "KS"],
    "28940": ["TN"], "29460": ["FL"], "29820": ["NV"],
    "30140": ["PA"], "30460": ["KY"], "30700": ["NE"],
    "30780": ["AR"], "31080": ["CA"], "31140": ["KY", "IN"],
    "31180": ["TX"], "32820": ["TN", "MS", "AR"],
    "33100": ["FL"], "33340": ["WI"], "33460": ["MN", "WI"],
    "34820": ["SC"], "34940": ["FL"], "34980": ["TN"],
    "35300": ["CT"], "35380": ["LA"],
    "35620": ["NY", "NJ", "PA"], "36420": ["OK"],
    "36540": ["NE", "IA"], "36740": ["FL"], "37100": ["CA"],
    "37980": ["PA", "NJ", "DE", "MD"], "38060": ["AZ"],
    "38300": ["PA"], "38900": ["OR", "WA"], "39300": ["RI", "MA"],
    "39580": ["NC"], "40060": ["VA"], "40140": ["CA"],
    "40380": ["NY"], "40900": ["CA"], "41180": ["MO", "IL"],
    "41620": ["UT"], "41700": ["TX"], "41740": ["CA"],
    "41860": ["CA"], "41940": ["CA"], "42540": ["PA"],
    "42660": ["WA"], "44140": ["MA"], "44700": ["CA"],
    "45300": ["FL"], "46060": ["AZ"], "46140": ["OK"],
    "46520": ["HI"], "47260": ["VA", "NC"],
    "47900": ["DC", "VA", "MD", "WV"], "48620": ["KS"],
    "49340": ["MA"],
};

// City → MSA code mapping
const CITY_MSA: Record<string, string> = {
    // Texas
    "houston-tx": "26420", "dallas-tx": "19100", "san-antonio-tx": "41700",
    "austin-tx": "12420", "fort-worth-tx": "19100", "el-paso-tx": "21340",
    "arlington-tx": "19100", "corpus-christi-tx": "18580", "plano-tx": "19100",
    "laredo-tx": "29700", "lubbock-tx": "31180", "garland-tx": "19100",
    "irving-tx": "19100", "frisco-tx": "19100", "mckinney-tx": "19100",
    "amarillo-tx": "11100", "grand-prairie-tx": "19100", "brownsville-tx": "15180",
    "killeen-tx": "28660", "pasadena-tx": "26420", "midland-tx": "33260",
    "mcallen-tx": "32580",
    // California
    "los-angeles-ca": "31080", "san-diego-ca": "41740", "san-jose-ca": "41940",
    "san-francisco-ca": "41860", "fresno-ca": "23420", "sacramento-ca": "40900",
    "long-beach-ca": "31080", "oakland-ca": "41860", "bakersfield-ca": "13060",
    "anaheim-ca": "31080", "santa-ana-ca": "31080", "riverside-ca": "40140",
    "stockton-ca": "44700", "irvine-ca": "31080", "chula-vista-ca": "41740",
    "moreno-valley-ca": "40140", "fontana-ca": "40140", "modesto-ca": "33700",
    "glendale-ca": "31080", "huntington-beach-ca": "31080", "santa-clarita-ca": "31080",
    "garden-grove-ca": "31080", "oceanside-ca": "41740", "rancho-cucamonga-ca": "40140",
    "ontario-ca": "40140", "santa-rosa-ca": "42220", "elk-grove-ca": "40900",
    "oxnard-ca": "37100", "hayward-ca": "41860", "sunnyvale-ca": "41940",
    // Florida
    "jacksonville-fl": "27260", "miami-fl": "33100", "tampa-fl": "45300",
    "orlando-fl": "36740", "st-petersburg-fl": "45300", "hialeah-fl": "33100",
    "tallahassee-fl": "45220", "port-st-lucie-fl": "38940", "cape-coral-fl": "15980",
    "fort-lauderdale-fl": "33100", "pembroke-pines-fl": "33100",
    // New York
    "new-york-ny": "35620", "buffalo-ny": "15380", "rochester-ny": "40380",
    "yonkers-ny": "35620", "syracuse-ny": "45060",
    // Others - major metros
    "chicago-il": "16980", "phoenix-az": "38060", "philadelphia-pa": "37980",
    "columbus-oh": "18140", "charlotte-nc": "16740", "indianapolis-in": "26900",
    "seattle-wa": "42660", "denver-co": "19740", "washington-dc": "47900",
    "nashville-tn": "34980", "oklahoma-city-ok": "36420", "boston-ma": "14460",
    "portland-or": "38900", "las-vegas-nv": "29820", "memphis-tn": "32820",
    "louisville-ky": "31140", "baltimore-md": "12580", "milwaukee-wi": "33340",
    "albuquerque-nm": "10740", "tucson-az": "46060", "mesa-az": "38060",
    "kansas-city-mo": "28140", "atlanta-ga": "12060", "omaha-ne": "36540",
    "colorado-springs-co": "17820", "raleigh-nc": "39580", "virginia-beach-va": "47260",
    "minneapolis-mn": "33460", "tulsa-ok": "46140", "new-orleans-la": "35380",
    "wichita-ks": "48620", "cleveland-oh": "17460", "aurora-co": "19740",
    "honolulu-hi": "26620", "st-paul-mn": "33460", "cincinnati-oh": "17140",
    "anchorage-ak": "11260", "henderson-nv": "29820", "greensboro-nc": "24660",
    "newark-nj": "35620", "lincoln-ne": "30700", "pittsburgh-pa": "38300",
    "lexington-ky": "30460", "detroit-mi": "19820", "boise-id": "14260",
    "richmond-va": "40060", "salt-lake-city-ut": "41620",
    "birmingham-al": "13820", "montgomery-al": "33860", "mobile-al": "33660",
    "huntsville-al": "26620",
    "little-rock-ar": "30780",
    "hartford-ct": "25540", "new-haven-ct": "35300", "bridgeport-ct": "14860", "stamford-ct": "14860",
    "wilmington-de": "37980",
    "baton-rouge-la": "12940", "shreveport-la": "43340",
    "charleston-sc": "16700", "columbia-sc": "17900", "greenville-sc": "24860",
    "chattanooga-tn": "16860", "knoxville-tn": "28940",
    "fayetteville-nc": "22180",
    "akron-oh": "10420", "dayton-oh": "19380", "toledo-oh": "45780",
    "spokane-wa": "44060", "tacoma-wa": "42660",
    "grand-rapids-mi": "24340",
    "providence-ri": "39300",
    "madison-wi": "31540",
    "des-moines-ia": "19780",
    "boise-city-id": "14260",
    "springfield-ma": "44140",
    "worcester-ma": "49340",
    "st-louis-mo": "41180",
    "durham-nc": "20500",
    "winston-salem-nc": "49180",
    "jersey-city-nj": "35620",
    "chandler-az": "38060", "scottsdale-az": "38060", "gilbert-az": "38060", "tempe-az": "38060",
    "reno-nv": "39900",
    "norfolk-va": "47260", "chesapeake-va": "47260", "newport-news-va": "47260", "alexandria-va": "47900",
    "savannah-ga": "42340", "augusta-ga": "12260",
    "lakewood-co": "19740", "thornton-co": "19740", "westminster-co": "19740",
    "fort-wayne-in": "23060", "evansville-in": "21780",
    "overland-park-ks": "28140", "olathe-ks": "28140",
    "north-las-vegas-nv": "29820",
    "naperville-il": "16980", "joliet-il": "16980", "elgin-il": "16980",
    "rockford-il": "40420", "peoria-il": "37900",
    // Backfill — remaining cities from cities.ts
    "fremont-ca": "41860", "san-bernardino-ca": "40140", "corona-ca": "40140",
    "glendale-az": "38060", "peoria-az": "38060",
    "fort-collins-co": "22660",
    "vancouver-wa": "38900",
    "salem-or": "41420", "eugene-or": "21660",
    "cary-nc": "39580",
    "clarksville-tn": "17300", "murfreesboro-tn": "34980",
    "springfield-mo": "44180",
    "sioux-falls-sd": "43620",
    "billings-mt": "13740", "missoula-mt": "32820", "bozeman-mt": "14580",
    "cheyenne-wy": "16220",
    "burlington-vt": "15540",
    "manchester-nh": "31700",
    "portland-me": "38860",
    "fargo-nd": "22020", "bismarck-nd": "13900",
    "jackson-ms": "27140",
    "rapid-city-sd": "39660",
    "topeka-ks": "45820",
    "charleston-wv": "16620",
    "concord-nh": "31700",
    "rochester-mn": "40340",
    "pensacola-fl": "37860", "lakeland-fl": "29460", "fort-myers-fl": "15980",
    "boca-raton-fl": "33100", "sarasota-fl": "42260",
    "provo-ut": "39340", "ogden-ut": "36260",
    "santa-fe-nm": "42140",
    "ann-arbor-mi": "11460", "lansing-mi": "29620",
};

// Population data for cities (Census estimates)
const CITY_POPULATIONS: Record<string, number> = {
    "new-york-ny": 8336817, "los-angeles-ca": 3979576, "chicago-il": 2693976,
    "houston-tx": 2304580, "phoenix-az": 1608139, "philadelphia-pa": 1603797,
    "san-antonio-tx": 1434625, "san-diego-ca": 1386932, "dallas-tx": 1304379,
    "austin-tx": 979882, "jacksonville-fl": 949611, "fort-worth-tx": 918915,
    "san-jose-ca": 1013240, "columbus-oh": 905748, "charlotte-nc": 874579,
    "indianapolis-in": 887642, "san-francisco-ca": 873965, "seattle-wa": 737015,
    "denver-co": 713252, "washington-dc": 689545, "nashville-tn": 683622,
    "oklahoma-city-ok": 681054, "el-paso-tx": 678815, "boston-ma": 675647,
    "portland-or": 652503, "las-vegas-nv": 646790, "memphis-tn": 633104,
    "louisville-ky": 633045, "baltimore-md": 585708, "milwaukee-wi": 577222,
    "albuquerque-nm": 564559, "tucson-az": 542629, "fresno-ca": 542107,
    "sacramento-ca": 524943, "mesa-az": 504258, "kansas-city-mo": 508090,
    "atlanta-ga": 498715, "omaha-ne": 489361, "colorado-springs-co": 478221,
    "raleigh-nc": 467665, "long-beach-ca": 466742, "virginia-beach-va": 459470,
    "miami-fl": 442241, "oakland-ca": 433031, "minneapolis-mn": 429954,
    "tampa-fl": 384959, "tulsa-ok": 413066, "arlington-tx": 394266,
    "new-orleans-la": 383997, "wichita-ks": 397532, "cleveland-oh": 372624,
    "bakersfield-ca": 403455, "aurora-co": 386261, "anaheim-ca": 350365,
    "honolulu-hi": 350964, "santa-ana-ca": 310227, "riverside-ca": 314998,
    "corpus-christi-tx": 317863, "lexington-ky": 322570, "pittsburgh-pa": 302971,
    "stockton-ca": 320804, "st-paul-mn": 311527, "cincinnati-oh": 309317,
    "anchorage-ak": 291247, "henderson-nv": 320189, "greensboro-nc": 299035,
    "plano-tx": 285494, "newark-nj": 311549, "lincoln-ne": 291082,
    "garland-tx": 246018, "irvine-ca": 307670, "orlando-fl": 307573,
    "detroit-mi": 639111, "richmond-va": 226610, "salt-lake-city-ut": 200133,
    "birmingham-al": 200733, "baton-rouge-la": 225374, "boise-id": 235684,
    "hartford-ct": 121054, "charleston-sc": 150227,
    // Backfill
    "fremont-ca": 230504, "san-bernardino-ca": 222101, "corona-ca": 157136,
    "glendale-az": 248325, "peoria-az": 190985,
    "fort-collins-co": 169810, "vancouver-wa": 190915,
    "salem-or": 178510, "eugene-or": 176654,
    "cary-nc": 174721, "clarksville-tn": 166722, "murfreesboro-tn": 152769,
    "springfield-mo": 169176, "sioux-falls-sd": 192517,
    "billings-mt": 119510, "missoula-mt": 77757, "bozeman-mt": 56908,
    "cheyenne-wy": 65132, "burlington-vt": 44743, "manchester-nh": 115644,
    "portland-me": 68408, "fargo-nd": 129907, "bismarck-nd": 74018,
    "jackson-ms": 153701, "rapid-city-sd": 78130, "topeka-ks": 126587,
    "charleston-wv": 48006, "concord-nh": 43976, "rochester-mn": 121395,
    "pensacola-fl": 54312, "lakeland-fl": 114529, "fort-myers-fl": 92754,
    "boca-raton-fl": 99805, "sarasota-fl": 57602,
    "provo-ut": 115919, "ogden-ut": 87321, "santa-fe-nm": 89177,
    "ann-arbor-mi": 123851, "lansing-mi": 112644,
};

/* ── Census API helpers ─────────────────────────────────── */

const CENSUS_GEO_STATE = "state:*";
const CENSUS_GEO_MSA = "metropolitan%20statistical%20area/micropolitan%20statistical%20area:*";

async function fetchCensusNAICS(naics: string, geo: string, label: string): Promise<Record<string, number>> {
    console.log(`  Fetching NAICS ${naics} (${label}) by ${geo.includes("state") ? "state" : "metro"}...`);
    const url = `https://api.census.gov/data/${CBP_YEAR}/cbp?get=ESTAB,NAICS2017_LABEL&for=${geo}&NAICS2017=${naics}`;
    const res = await fetch(url);
    const data = await res.json() as string[][];

    const result: Record<string, number> = {};
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const estab = row[0];
        const geoCode = row[row.length - 1]; // last column is always the geo code
        result[geoCode] = parseInt(estab, 10);
    }
    console.log(`    ✓ ${Object.keys(result).length} entries`);
    // Be polite to Census API
    await new Promise(r => setTimeout(r, 300));
    return result;
}

async function fetchAllCensusData() {
    const fipsToState = Object.fromEntries(
        Object.entries(STATE_FIPS).map(([k, v]) => [v, k])
    );

    console.log("📊 Fetching Census Bureau data...\n");

    // State-level: janitorial company counts
    const janitorialByFips = await fetchCensusNAICS("561720", CENSUS_GEO_STATE, "Janitorial Services");
    const janitorialByState: Record<string, number> = {};
    for (const [fips, count] of Object.entries(janitorialByFips)) {
        const sc = fipsToState[fips];
        if (sc) janitorialByState[sc] = count;
    }

    // Metro-level: industry counts (potential clients)
    const officesByMSA = await fetchCensusNAICS("5311", CENSUS_GEO_MSA, "Lessors of Real Estate (offices)");
    const medicalByMSA = await fetchCensusNAICS("6211", CENSUS_GEO_MSA, "Offices of Physicians (medical)");
    const schoolsByMSA = await fetchCensusNAICS("6111", CENSUS_GEO_MSA, "Elementary & Secondary Schools");

    return { janitorialByState, officesByMSA, medicalByMSA, schoolsByMSA };
}

/* ── Output file generation ─────────────────────────────── */

interface CensusResults {
    janitorialByState: Record<string, number>;
    officesByMSA: Record<string, number>;
    medicalByMSA: Record<string, number>;
    schoolsByMSA: Record<string, number>;
}

function generateMarketDataFile(census: CensusResults): string {
    const lines: string[] = [];

    lines.push(`/**`);
    lines.push(` * Market data for xiriOS pSEO pages`);
    lines.push(` * `);
    lines.push(` * AUTO-GENERATED — do not edit manually.`);
    lines.push(` * Run: npx tsx scripts/generate-market-data.ts`);
    lines.push(` * `);
    lines.push(` * Sources:`);
    lines.push(` *   - Census Bureau County Business Patterns (${CBP_YEAR})`);
    lines.push(` *     NAICS 561720 (Janitorial Services) by state`);
    lines.push(` *     NAICS 5311 (Office Properties) by metro`);
    lines.push(` *     NAICS 6211 (Medical Facilities) by metro`);
    lines.push(` *     NAICS 6111 (Schools) by metro`);
    lines.push(` *   - Bureau of Labor Statistics OEWS (${BLS_YEAR}), SOC 37-2011`);
    lines.push(` *   - State minimum wage data (Jan 2025)`);
    lines.push(` * `);
    lines.push(` * Last refreshed: ${new Date().toISOString().split("T")[0]}`);
    lines.push(` */`);
    lines.push(``);

    // Data sources
    lines.push(`export const DATA_SOURCES = {`);
    lines.push(`    census: {`);
    lines.push(`        name: "U.S. Census Bureau",`);
    lines.push(`        dataset: "County Business Patterns (${CBP_YEAR})",`);
    lines.push(`        baseUrl: "https://data.census.gov/table/CBP${CBP_YEAR}.CB2200CBP?t=Janitorial+Services",`);
    lines.push(`        stateUrl: (fips: string) => \`https://data.census.gov/table/CBP${CBP_YEAR}.CB2200CBP?t=Janitorial+Services&g=0400000US\${fips}\`,`);
    lines.push(`    },`);
    lines.push(`    bls: {`);
    lines.push(`        name: "Bureau of Labor Statistics",`);
    lines.push(`        dataset: "Occupational Employment & Wage Statistics (${BLS_YEAR})",`);
    lines.push(`        soc: "37-2011 — Janitors and Cleaners",`);
    lines.push(`        url: "https://www.bls.gov/oes/current/oes372011.htm",`);
    lines.push(`    },`);
    lines.push(`} as const;`);
    lines.push(``);

    // State FIPS codes
    lines.push(`export const STATE_FIPS: Record<string, string> = ${JSON.stringify(STATE_FIPS, null, 4)};`);
    lines.push(``);

    // State data (janitorial companies + min wage)
    lines.push(`export interface StateMarketData {`);
    lines.push(`    janitorialCompanies: number;`);
    lines.push(`    minWage: number;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`export const STATE_DATA: Record<string, StateMarketData> = {`);
    const sortedStates = Object.keys(census.janitorialByState).sort();
    for (const sc of sortedStates) {
        const companies = census.janitorialByState[sc];
        const minWage = STATE_MIN_WAGES[sc] ?? 7.25;
        lines.push(`    ${sc}: { janitorialCompanies: ${companies}, minWage: ${minWage} },`);
    }
    lines.push(`};`);
    lines.push(``);

    // Metro data: wages + industry counts
    lines.push(`export interface MetroMarketData {`);
    lines.push(`    name: string;`);
    lines.push(`    medianWage: number;`);
    lines.push(`    officeProperties: number;`);
    lines.push(`    medicalFacilities: number;`);
    lines.push(`    schools: number;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`export const METRO_DATA: Record<string, MetroMarketData> = {`);
    for (const [code, data] of Object.entries(MSA_DATA).sort((a, b) => a[0].localeCompare(b[0]))) {
        const offices = census.officesByMSA[code] || 0;
        const medical = census.medicalByMSA[code] || 0;
        const schools = census.schoolsByMSA[code] || 0;
        lines.push(`    "${code}": { name: "${data.name}", medianWage: ${data.medianWage}, officeProperties: ${offices}, medicalFacilities: ${medical}, schools: ${schools} },`);
    }
    lines.push(`};`);
    lines.push(``);

    // City → MSA mapping
    lines.push(`export const CITY_MSA_MAP: Record<string, string> = {`);
    for (const [city, msa] of Object.entries(CITY_MSA).sort()) {
        lines.push(`    "${city}": "${msa}",`);
    }
    lines.push(`};`);
    lines.push(``);

    // City populations
    lines.push(`export const CITY_POPULATIONS: Record<string, number> = {`);
    for (const [city, pop] of Object.entries(CITY_POPULATIONS).sort()) {
        lines.push(`    "${city}": ${pop},`);
    }
    lines.push(`};`);
    lines.push(``);

    // National median
    lines.push(`/** National median hourly wage for janitors (BLS, ${BLS_YEAR}) */`);
    lines.push(`export const NATIONAL_MEDIAN_WAGE = 17.27;`);
    lines.push(``);

    // Helper function
    lines.push(`/** Get market data for a city by its slug */`);
    lines.push(`export function getCityMarketData(slug: string, stateCode: string) {`);
    lines.push(`    const msaCode = CITY_MSA_MAP[slug];`);
    lines.push(`    const metro = msaCode ? METRO_DATA[msaCode] : undefined;`);
    lines.push(`    const state = STATE_DATA[stateCode];`);
    lines.push(`    const population = CITY_POPULATIONS[slug];`);
    lines.push(`    const fips = STATE_FIPS[stateCode];`);
    lines.push(``);
    lines.push(`    return {`);
    lines.push(`        population,`);
    lines.push(`        metro,`);
    lines.push(`        state,`);
    lines.push(`        fips,`);
    lines.push(`        censusUrl: fips ? DATA_SOURCES.census.stateUrl(fips) : DATA_SOURCES.census.baseUrl,`);
    lines.push(`        blsUrl: DATA_SOURCES.bls.url,`);
    lines.push(`        wageVsNational: metro`);
    lines.push(`            ? Math.round(((metro.medianWage - NATIONAL_MEDIAN_WAGE) / NATIONAL_MEDIAN_WAGE) * 100)`);
    lines.push(`            : undefined,`);
    lines.push(`        /** Total potential commercial clients in this metro */`);
    lines.push(`        totalPotentialClients: metro`);
    lines.push(`            ? metro.officeProperties + metro.medicalFacilities + metro.schools`);
    lines.push(`            : undefined,`);
    lines.push(`    };`);
    lines.push(`}`);
    lines.push(``);

    return lines.join("\n");
}

/** Generate a lean metro-wages.ts for the dashboard calculator */
function generateMetroWagesFile(): string {
    const lines: string[] = [];
    lines.push(`/**`);
    lines.push(` * Metro-level BLS wage data for xiriOS Calculator`);
    lines.push(` * `);
    lines.push(` * AUTO-GENERATED — do not edit manually.`);
    lines.push(` * Run: npx tsx scripts/generate-market-data.ts`);
    lines.push(` * `);
    lines.push(` * Source: Bureau of Labor Statistics OEWS (May ${BLS_YEAR}), SOC 37-2011`);
    lines.push(` * Last refreshed: ${new Date().toISOString().split("T")[0]}`);
    lines.push(` */`);
    lines.push(``);

    lines.push(`export interface MetroWageData {`);
    lines.push(`    id: string;`);
    lines.push(`    name: string;`);
    lines.push(`    /** BLS median hourly wage for janitors in this metro */`);
    lines.push(`    medianWage: number;`);
    lines.push(`    /** State codes this metro belongs to (for dropdown filtering) */`);
    lines.push(`    states: string[];`);
    lines.push(`}`);
    lines.push(``);

    lines.push(`export const METRO_WAGES: MetroWageData[] = [`);
    for (const [msaCode, msa] of Object.entries(MSA_DATA).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
        const states = MSA_STATES[msaCode] || [];
        const statesArr = states.map((s: string) => `"${s}"`).join(", ");
        lines.push(`    { id: "${msaCode}", name: "${msa.name}", medianWage: ${msa.medianWage}, states: [${statesArr}] },`);
    }
    lines.push(`];`);
    lines.push(``);

    lines.push(`/** Get metros available for a given state code */`);
    lines.push(`export function getMetrosForState(stateCode: string): MetroWageData[] {`);
    lines.push(`    return METRO_WAGES.filter((m) => m.states.includes(stateCode));`);
    lines.push(`}`);
    lines.push(``);

    lines.push(`/** National median hourly wage for janitors (BLS, ${BLS_YEAR}) */`);
    lines.push(`export const NATIONAL_MEDIAN_WAGE = 17.27;`);
    lines.push(``);

    // ── ZIP3 → state mapping (USPS standard ranges) ──
    lines.push(`/**`);
    lines.push(` * ZIP3 prefix → state code (USPS standard ranges)`);
    lines.push(` * Used to resolve a 5-digit ZIP to a state code`);
    lines.push(` */`);
    lines.push(`const ZIP3_STATE: [number, number, string][] = [`);
    // Standard USPS ZIP3 ranges per state (inclusive min, inclusive max, state code)
    const ZIP3_RANGES: [number, number, string][] = [
        [10, 14, "NY"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
        [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"],
        [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
        [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
        [370, 385, "TN"], [386, 397, "MS"], [400, 427, "KY"],
        [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"],
        [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"],
        [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"],
        [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"],
        [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"],
        [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"],
        [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
        [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"],
        [900, 966, "CA"], [967, 968, "HI"], [970, 979, "OR"],
        [980, 994, "WA"], [995, 999, "AK"],
        [1, 5, "MA"], [6, 9, "PR"], [10, 14, "NY"],
        [15, 19, "PA"], [20, 27, "MA"], [28, 29, "RI"],
        [30, 38, "NH"], [39, 49, "ME"], [50, 54, "VT"],
    ];
    for (const [min, max, state] of ZIP3_RANGES) {
        lines.push(`    [${min}, ${max}, "${state}"],`);
    }
    lines.push(`];`);
    lines.push(``);

    // ── ZIP3 → MSA code for our tracked metros ──
    lines.push(`/** ZIP3 prefix → MSA code for tracked metros */`);
    lines.push(`const ZIP3_MSA: Record<string, string> = {`);
    // Map ZIP3 → MSA for our tracked metros
    const ZIP3_MSA_MAP: Record<string, string> = {
        // New York
        "100": "35620", "101": "35620", "102": "35620", "103": "35620", "104": "35620",
        "110": "35620", "111": "35620", "112": "35620", "113": "35620", "114": "35620",
        "070": "35620", "071": "35620", "072": "35620", "073": "35620", "074": "35620",
        "075": "35620", "076": "35620", "077": "35620", "078": "35620", "079": "35620",
        // Los Angeles
        "900": "31080", "901": "31080", "902": "31080", "903": "31080", "904": "31080",
        "905": "31080", "906": "31080", "907": "31080", "908": "31080",
        "910": "31080", "911": "31080", "912": "31080", "913": "31080", "914": "31080",
        "915": "31080", "916": "31080", "917": "31080", "918": "31080",
        // San Francisco / Oakland / Berkeley
        "940": "41860", "941": "41860", "942": "41860", "943": "41860", "944": "41860",
        "945": "41860", "948": "41860",
        // San Jose
        "950": "41940", "951": "41940",
        // San Diego
        "919": "41740", "920": "41740", "921": "41740",
        // Sacramento
        "956": "40900", "957": "40900", "958": "40900",
        // Riverside-San Bernardino
        "922": "40140", "923": "40140", "924": "40140", "925": "40140", "926": "40140",
        // Fresno
        "936": "23420", "937": "23420",
        // Stockton
        "952": "44700", "953": "44700",
        // Oxnard-Ventura
        "930": "37100", "931": "37100",
        // Chicago
        "600": "16980", "601": "16980", "602": "16980", "603": "16980", "604": "16980",
        "605": "16980", "606": "16980", "607": "16980", "608": "16980",
        // Dallas-Fort Worth
        "750": "19100", "751": "19100", "752": "19100", "753": "19100",
        "760": "19100", "761": "19100", "762": "19100",
        // Houston
        "770": "26420", "771": "26420", "772": "26420", "773": "26420",
        "774": "26420", "775": "26420", "776": "26420", "777": "26420",
        // San Antonio
        "780": "41700", "781": "41700", "782": "41700",
        // Austin
        "786": "12420", "787": "12420",
        // El Paso
        "798": "21340", "799": "21340",
        // Corpus Christi
        "783": "18580", "784": "18580",
        // Lubbock
        "793": "31180", "794": "31180",
        // Brownsville
        "785": "15180",
        // Phoenix
        "850": "38060", "851": "38060", "852": "38060", "853": "38060",
        // Tucson
        "856": "46060", "857": "46060",
        // Philadelphia
        "190": "37980", "191": "37980", "192": "37980", "193": "37980",
        "080": "37980", "081": "37980", "082": "37980", "083": "37980",
        // Pittsburgh
        "150": "38300", "151": "38300", "152": "38300",
        // Atlanta
        "300": "12060", "301": "12060", "302": "12060", "303": "12060",
        "309": "12060", "310": "12060", "311": "12060",
        // Miami-Fort Lauderdale
        "330": "33100", "331": "33100", "332": "33100", "333": "33100", "334": "33100",
        // Tampa-St. Petersburg
        "335": "45300", "336": "45300", "337": "45300", "338": "45300",
        // Orlando
        "327": "36740", "328": "36740", "347": "36740", "348": "36740",
        // Jacksonville
        "320": "27260", "321": "27260", "322": "27260",
        // Cape Coral-Fort Myers
        "339": "15980",
        // Naples
        "341": "34940",
        // Seattle
        "980": "42660", "981": "42660", "982": "42660", "983": "42660", "984": "42660",
        // Portland
        "970": "38900", "971": "38900", "972": "38900", "973": "38900",
        // Denver
        "800": "19740", "801": "19740", "802": "19740", "803": "19740", "804": "19740",
        // Colorado Springs
        "808": "17820", "809": "17820",
        // Washington DC
        "200": "47900", "201": "47900", "202": "47900", "203": "47900",
        "204": "47900", "205": "47900", "206": "47900", "207": "47900",
        "208": "47900", "209": "47900", "220": "47900", "221": "47900",
        "222": "47900",
        // Baltimore
        "210": "12580", "211": "12580", "212": "12580",
        // Boston
        "021": "14460", "022": "14460", "023": "14460", "024": "14460",
        // Minneapolis
        "550": "33460", "551": "33460", "553": "33460", "554": "33460", "555": "33460",
        // Detroit
        "480": "19820", "481": "19820", "482": "19820", "483": "19820", "484": "19820",
        // Nashville
        "370": "34980", "371": "34980", "372": "34980",
        // Charlotte
        "280": "16740", "281": "16740", "282": "16740",
        // Indianapolis
        "460": "26900", "461": "26900", "462": "26900",
        // Columbus
        "430": "18140", "431": "18140", "432": "18140",
        // Cleveland
        "440": "17460", "441": "17460", "442": "17460",
        // Cincinnati
        "450": "17140", "451": "17140", "452": "17140",
        // Kansas City
        "640": "28140", "641": "28140", "660": "28140", "661": "28140", "662": "28140",
        // St. Louis
        "630": "41180", "631": "41180", "633": "41180",
        // Salt Lake City
        "840": "41620", "841": "41620", "842": "41620",
        // Las Vegas
        "889": "29820", "890": "29820", "891": "29820",
        // Oklahoma City
        "730": "36420", "731": "36420",
        // Tulsa
        "740": "46140", "741": "46140",
        // Milwaukee
        "530": "33340", "531": "33340", "532": "33340",
        // Honolulu
        "967": "26620", "968": "26620",
        // Birmingham
        "350": "13820", "351": "13820", "352": "13820",
        // Memphis
        "380": "32820", "381": "32820",
        // Louisville
        "400": "31140", "401": "31140", "402": "31140",
        // Raleigh
        "275": "39580", "276": "39580",
        // Richmond
        "230": "40060", "231": "40060", "232": "40060",
        // Virginia Beach-Norfolk
        "233": "47260", "234": "47260", "235": "47260", "236": "47260",
        // Baton Rouge
        "707": "12940", "708": "12940",
        // New Orleans
        "700": "35380", "701": "35380",
        // Omaha
        "680": "36540", "681": "36540",
        // Albuquerque
        "870": "10740", "871": "10740",
        // Buffalo
        "140": "15380", "141": "15380", "142": "15380", "143": "15380",
        // Rochester NY
        "144": "40380", "145": "40380", "146": "40380",
        // Albany
        "120": "10580", "121": "10580", "122": "10580",
        // Hartford
        "060": "25540", "061": "25540",
        // New Haven
        "064": "35300", "065": "35300",
        // Bridgeport-Stamford
        "066": "14860", "068": "14860", "069": "14860",
        // Providence
        "028": "39300", "029": "39300",
        // Anchorage
        "995": "11260",
        // Boise
        "836": "14260", "837": "14260",
        // Grand Rapids
        "493": "24340", "494": "24340", "495": "24340",
        // Charleston SC
        "294": "16700",
        // Columbia SC
        "290": "17900", "291": "17900",
        // Greenville SC
        "296": "24860",
        // Chattanooga
        "374": "16860",
        // Knoxville
        "377": "28940", "378": "28940", "379": "28940",
        // Greensboro
        "271": "24660", "272": "24660",
        // Fayetteville NC
        "283": "22180",
        // Little Rock
        "720": "30780", "721": "30780", "722": "30780",
        // Lincoln NE
        "683": "30700", "684": "30700", "685": "30700",
        // Lexington KY
        "403": "30460", "405": "30460",
        // Wichita
        "670": "48620", "671": "48620", "672": "48620",
        // Akron
        "443": "10420", "444": "10420",
        // Dayton
        "453": "19380", "454": "19380",
        // Lancaster PA
        "175": "30140", "176": "30140",
        // Scranton
        "184": "42540", "185": "42540", "186": "42540",
        // Springfield MA
        "010": "44140", "011": "44140",
        // Worcester MA
        "015": "49340", "016": "49340",
    };
    for (const [zip3, msa] of Object.entries(ZIP3_MSA_MAP).sort()) {
        lines.push(`    "${zip3}": "${msa}",`);
    }
    lines.push(`};`);
    lines.push(``);

    // resolveZip function
    lines.push(`/** Resolve a 5-digit ZIP code to state code and optional metro area */`);
    lines.push(`export function resolveZip(zip: string): { state: string; metroId?: string; metro?: MetroWageData } | null {`);
    lines.push(`    if (!zip || zip.length < 3) return null;`);
    lines.push(`    const z3 = zip.slice(0, 3);`);
    lines.push(`    const z3num = parseInt(z3, 10);`);
    lines.push(`    if (isNaN(z3num)) return null;`);
    lines.push(``);
    lines.push(`    // Find state from ZIP3 ranges`);
    lines.push(`    let state = "";`);
    lines.push(`    for (const [min, max, st] of ZIP3_STATE) {`);
    lines.push(`        if (z3num >= min && z3num <= max) { state = st; break; }`);
    lines.push(`    }`);
    lines.push(`    if (!state) return null;`);
    lines.push(``);
    lines.push(`    // Find metro from ZIP3 → MSA mapping`);
    lines.push(`    const msaCode = ZIP3_MSA[z3];`);
    lines.push(`    const metro = msaCode ? METRO_WAGES.find((m) => m.id === msaCode) : undefined;`);
    lines.push(``);
    lines.push(`    return { state, metroId: msaCode, metro };`);
    lines.push(`}`);
    lines.push(``);

    return lines.join("\n");
}


async function main() {
    const census = await fetchAllCensusData();
    const output = generateMarketDataFile(census);

    // Write marketing market-data.ts
    const outPath = path.resolve(__dirname, "../apps/marketing/lib/market-data.ts");
    fs.writeFileSync(outPath, output, "utf-8");

    // Write dashboard metro-wages.ts
    const metroWagesOutput = generateMetroWagesFile();
    const metroWagesPath = path.resolve(__dirname, "../apps/dashboard/src/lib/metro-wages.ts");
    fs.writeFileSync(metroWagesPath, metroWagesOutput, "utf-8");

    const msaCodes = Object.keys(MSA_DATA);
    const withIndustry = msaCodes.filter(c => census.officesByMSA[c] || census.medicalByMSA[c] || census.schoolsByMSA[c]);
    console.log(`\n✅ Written to ${outPath}`);
    console.log(`   ${Object.keys(census.janitorialByState).length} states (janitorial)`);
    console.log(`   ${withIndustry.length}/${msaCodes.length} metros with industry data`);
    console.log(`   ${Object.keys(CITY_MSA).length} city mappings`);
    console.log(`\n✅ Written to ${metroWagesPath}`);
    console.log(`   ${msaCodes.length} metros with BLS wage data`);
}

main().catch(console.error);

