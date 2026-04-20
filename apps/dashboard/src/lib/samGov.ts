/**
 * SAM.gov API Client
 * 
 * Provides access to Federal Contract Opportunities and Entity Management data.
 * Requires SAM_GOV_API_KEY to be set in environment variables.
 * 
 * API Documentation: https://open.gsa.gov/api/
 */

const BASE_URL = 'https://api.sam.gov';

export interface SamOpportunity {
    noticeId: string;
    title: string;
    solicitationNumber?: string;
    fullParentPathName?: string; // Agency/Dept
    postedDate: string;
    type?: string;
    baseType?: string;
    archiveDate?: string;
    liveData?: boolean;
    organizationHierarchy?: string;
    active?: string;
    award?: {
        date: string;
        number: string;
        amount: string;
        vendor?: string;
    };
    description?: string;
    uiLink?: string;
}

export interface SamSearchParams {
    q?: string;               // Keywords
    nCode?: string;          // NAICS code (e.g. 561720 for Janitorial)
    pCode?: string;          // PSC code
    is_active?: boolean;
    postedFrom?: string;     // MM/DD/YYYY
    postedTo?: string;       // MM/DD/YYYY
    limit?: number;
    offset?: number;
}

/**
 * Search for Federal Contract Opportunities.
 * Targets Janitorial (561720) and Facilities Support (561210) by default if no params provided.
 */
export async function searchOpportunities(params: SamSearchParams = {}): Promise<{ opportunities: SamOpportunity[]; totalCount: number }> {
    const apiKey = process.env.SAM_GOV_API_KEY || process.env.VITE_SAM_GOV_API_KEY;
    
    if (!apiKey) {
        throw new Error('SAM_GOV_API_KEY is not configured. Please add it to your .env.local file.');
    }

    const url = new URL(`${BASE_URL}/opportunities/v2/search`);
    
    // Add default Janitorial NAICS if none specified
    const naics = params.nCode || '561720'; 
    
    const queryParams: Record<string, string> = {
        api_key: apiKey,
        limit: (params.limit || 20).toString(),
        offset: (params.offset || 0).toString(),
        nCode: naics,
        is_active: (params.is_active !== false).toString(), // Default to active
    };

    if (params.q) queryParams.q = params.q;
    if (params.postedFrom) queryParams.postedFrom = params.postedFrom;
    if (params.postedTo) queryParams.postedTo = params.postedTo;

    Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

    const response = await fetch(url.toString());
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SAM.gov API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // SAM.gov returns { success: boolean, totalRecords: number, opportunitiesData: [...] }
    const rawOpportunities = data.opportunitiesData || [];
    
    const opportunities: SamOpportunity[] = rawOpportunities.map((opp: any) => ({
        noticeId: opp.noticeId,
        title: opp.title,
        solicitationNumber: opp.solicitationNumber,
        fullParentPathName: opp.fullParentPathName,
        postedDate: opp.postedDate,
        type: opp.type,
        baseType: opp.baseType,
        archiveDate: opp.archiveDate,
        uiLink: `https://sam.gov/opp/${opp.noticeId}/view`,
        description: opp.description,
        award: opp.award ? {
            date: opp.award.date,
            number: opp.award.number,
            amount: opp.award.amount,
            vendor: opp.award.vendorName
        } : undefined
    }));

    return {
        opportunities,
        totalCount: data.totalRecords || 0
    };
}

/**
 * Fetch detailed information for a specific opportunity.
 */
export async function getOpportunityDetails(noticeId: string): Promise<SamOpportunity> {
    const apiKey = process.env.SAM_GOV_API_KEY || process.env.VITE_SAM_GOV_API_KEY;
    if (!apiKey) throw new Error('SAM_GOV_API_KEY is not configured.');

    const url = `${BASE_URL}/opportunities/v2/search?api_key=${apiKey}&noticeId=${noticeId}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`SAM.gov Opportunity Detail error: ${response.status}`);
    
    const data = await response.json();
    const opp = data.opportunitiesData?.[0];
    
    if (!opp) throw new Error(`Opportunity ${noticeId} not found.`);

    return {
        noticeId: opp.noticeId,
        title: opp.title,
        solicitationNumber: opp.solicitationNumber,
        fullParentPathName: opp.fullParentPathName,
        postedDate: opp.postedDate,
        uiLink: `https://sam.gov/opp/${opp.noticeId}/view`,
        description: opp.description,
    };
}
