import { RawProperty } from '@xiri/shared';

// ── Provider Interface ──
// Swap implementations without touching business logic.
// Each provider normalizes its API response to RawProperty[].

export interface PropertyDataProvider {
    name: string;
    search(params: PropertySearchParams): Promise<RawProperty[]>;
}

export interface PropertySearchParams {
    query: string;              // e.g. "urgent care", "auto dealership"
    location: string;           // e.g. "Williston Park, NY"
    minSquareFootage?: number;
    maxSquareFootage?: number;
    maxResults?: number;        // default 25
}

// ── Mock Provider ──
// Returns realistic test data for development.
// Replace with ATTOM / Reonomy when ready.

class MockPropertyProvider implements PropertyDataProvider {
    name = 'mock';

    async search(params: PropertySearchParams): Promise<RawProperty[]> {
        console.log(`[MockPropertyProvider] Searching "${params.query}" in "${params.location}"...`);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const mockProperties: RawProperty[] = [
            {
                name: 'Williston Park Medical Plaza',
                address: '420 Willis Ave',
                city: 'Williston Park',
                state: 'NY',
                zip: '11596',
                propertyType: 'medical_office',
                squareFootage: 8500,
                yearBuilt: 2005,
                ownerName: 'WP Medical Holdings LLC',
                ownerPhone: '(516) 555-0101',
                tenantName: 'CityMD Urgent Care',
                tenantCount: 1,
                lastSalePrice: 2400000,
                lastSaleDate: '2021-06-15',
                source: 'mock',
                sourceId: 'MOCK-001',
            },
            {
                name: 'Mineola Surgical Center',
                address: '155 E 2nd St',
                city: 'Mineola',
                state: 'NY',
                zip: '11501',
                propertyType: 'medical_office',
                squareFootage: 12000,
                yearBuilt: 2010,
                ownerName: 'Mineola Health Properties Inc',
                ownerPhone: '(516) 555-0202',
                tenantName: 'North Shore Ambulatory Surgery',
                tenantCount: 1,
                lastSalePrice: 4200000,
                lastSaleDate: '2019-03-22',
                source: 'mock',
                sourceId: 'MOCK-002',
            },
            {
                name: 'New Hyde Park Dialysis Suite',
                address: '700 Lakeville Rd',
                city: 'New Hyde Park',
                state: 'NY',
                zip: '11040',
                propertyType: 'medical_office',
                squareFootage: 5200,
                yearBuilt: 2015,
                ownerName: 'NHP Realty Corp',
                ownerPhone: '(516) 555-0303',
                tenantName: 'DaVita Kidney Care',
                tenantCount: 1,
                lastSalePrice: 1800000,
                lastSaleDate: '2022-09-10',
                source: 'mock',
                sourceId: 'MOCK-003',
            },
            {
                name: 'Herricks Auto Center',
                address: '200 Herricks Rd',
                city: 'New Hyde Park',
                state: 'NY',
                zip: '11040',
                propertyType: 'auto_dealership',
                squareFootage: 22000,
                yearBuilt: 1998,
                ownerName: 'Herricks Motors LLC',
                ownerPhone: '(516) 555-0404',
                tenantName: 'Herricks Toyota',
                tenantCount: 1,
                lotSize: 45000,
                lastSalePrice: 5500000,
                lastSaleDate: '2018-01-20',
                source: 'mock',
                sourceId: 'MOCK-004',
            },
            {
                name: 'Floral Park Urgent Care',
                address: '265 Jericho Tpke',
                city: 'Floral Park',
                state: 'NY',
                zip: '11001',
                propertyType: 'medical_office',
                squareFootage: 4800,
                yearBuilt: 2012,
                ownerName: 'FP Healthcare Properties',
                ownerPhone: '(516) 555-0505',
                tenantName: 'GoHealth Urgent Care',
                tenantCount: 1,
                lastSalePrice: 1500000,
                lastSaleDate: '2020-07-05',
                source: 'mock',
                sourceId: 'MOCK-005',
            },
            {
                name: 'Garden City Auto Mile',
                address: '500 Stewart Ave',
                city: 'Garden City',
                state: 'NY',
                zip: '11530',
                propertyType: 'auto_dealership',
                squareFootage: 35000,
                yearBuilt: 2001,
                ownerName: 'GC Auto Holdings LLC',
                ownerPhone: '(516) 555-0606',
                tenantName: 'Legacy Honda',
                tenantCount: 1,
                lotSize: 80000,
                lastSalePrice: 8200000,
                lastSaleDate: '2017-11-30',
                source: 'mock',
                sourceId: 'MOCK-006',
            },
        ];

        // Apply sq ft filters if provided
        let filtered = mockProperties;
        if (params.minSquareFootage) {
            filtered = filtered.filter(p => (p.squareFootage || 0) >= params.minSquareFootage!);
        }
        if (params.maxSquareFootage) {
            filtered = filtered.filter(p => (p.squareFootage || 0) <= params.maxSquareFootage!);
        }

        // Apply query filter (simple keyword match on propertyType or tenantName)
        const queryLower = params.query.toLowerCase();
        if (queryLower.includes('medical') || queryLower.includes('urgent') || queryLower.includes('surgery') || queryLower.includes('dialysis')) {
            filtered = filtered.filter(p => p.propertyType === 'medical_office');
        } else if (queryLower.includes('auto') || queryLower.includes('dealer')) {
            filtered = filtered.filter(p => p.propertyType === 'auto_dealership');
        }

        const maxResults = params.maxResults || 25;
        const results = filtered.slice(0, maxResults);

        console.log(`[MockPropertyProvider] Returning ${results.length} mock properties.`);
        return results;
    }
}

// ── Future Provider Stubs ──

// class AttomPropertyProvider implements PropertyDataProvider {
//     name = 'attom';
//     async search(params: PropertySearchParams): Promise<RawProperty[]> {
//         // TODO: Implement ATTOM Data API integration
//         // const apiKey = process.env.ATTOM_API_KEY;
//         // const response = await axios.get('https://api.gateway.attomdata.com/...', { ... });
//         // return normalize(response.data);
//         throw new Error('ATTOM provider not yet implemented');
//     }
// }

// class ReonomyPropertyProvider implements PropertyDataProvider {
//     name = 'reonomy';
//     async search(params: PropertySearchParams): Promise<RawProperty[]> {
//         // TODO: Implement Reonomy/Altus API integration
//         throw new Error('Reonomy provider not yet implemented');
//     }
// }

// ── Provider Factory ──

const providers: Record<string, () => PropertyDataProvider> = {
    mock: () => new MockPropertyProvider(),
    // attom: () => new AttomPropertyProvider(),
    // reonomy: () => new ReonomyPropertyProvider(),
};

export function getPropertyProvider(name: string): PropertyDataProvider {
    const factory = providers[name];
    if (!factory) {
        console.warn(`[PropertySourcer] Unknown provider "${name}", falling back to mock.`);
        return new MockPropertyProvider();
    }
    return factory();
}

// ── Main Search Function ──
// Called by the Cloud Function callable.

export const searchProperties = async (
    query: string,
    location: string,
    providerName: string = 'mock',
): Promise<RawProperty[]> => {
    console.log(`[PropertySourcer] Sourcing: "${query}" in "${location}" via ${providerName}`);

    const provider = getPropertyProvider(providerName);

    try {
        const properties = await provider.search({ query, location });
        console.log(`[PropertySourcer] ${provider.name} returned ${properties.length} results.`);

        // Filter to single-tenant (tenantCount === 1 or undefined/null)
        const singleTenant = properties.filter(p => !p.tenantCount || p.tenantCount === 1);
        console.log(`[PropertySourcer] After single-tenant filter: ${singleTenant.length}`);

        return singleTenant;
    } catch (error: any) {
        console.error(`[PropertySourcer] Error sourcing properties: ${error.message}`);
        throw new Error(`Failed to source properties: ${error.message}`);
    }
};
