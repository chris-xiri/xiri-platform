// ─── MarketSnapshot ──────────────────────────────────────────────
// Renders Census-sourced establishment counts as a stats bar.
// Designed for industry pillar pages and individual industry pages.
// Data is fetched dynamically at build time from Census Bureau API.

import { Citation } from './Citation';
import { CENSUS_CITATION } from '@/data/gov-data';
import type { CensusEstablishmentResult } from '@/lib/census';

// ─── Pillar-Level Stats (aggregated across facility types) ───────

interface PillarSnapshotProps {
    /** Pillar display name, e.g. "Healthcare" */
    pillarName: string;
    /** Results from getEstablishmentsBatch() */
    results: CensusEstablishmentResult[];
    /** Total across all results */
    total: number;
    /** Area label override */
    areaLabel?: string;
}

export function PillarMarketSnapshot({ pillarName, results, total, areaLabel }: PillarSnapshotProps) {
    if (total === 0) return null;

    const area = areaLabel || results[0]?.areaLabel || 'your area';
    const topStats = results
        .filter(r => r.establishments > 0)
        .sort((a, b) => b.establishments - a.establishments)
        .slice(0, 4);

    return (
        <section className="py-10 bg-sky-50/50 border-y border-sky-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-6">
                    <p className="text-sm font-semibold text-sky-700 uppercase tracking-wider mb-1">
                        Market Snapshot
                    </p>
                    <p className="text-lg text-slate-700">
                        <span className="font-bold text-slate-900">{total.toLocaleString()}+</span>{' '}
                        {pillarName.toLowerCase()} facilities operate in {area}
                    </p>
                    <Citation
                        source={CENSUS_CITATION.source}
                        dataset={CENSUS_CITATION.dataset}
                        year={CENSUS_CITATION.year}
                        url={CENSUS_CITATION.baseUrl}
                        className="mt-1 justify-center"
                    />
                </div>

                {topStats.length > 1 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                        {topStats.map(stat => (
                            <div key={stat.facilitySlug} className="text-center">
                                <p className="text-2xl font-bold text-sky-700">
                                    {stat.establishments.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                    {stat.facilitySlug.replace(/-/g, ' ')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Single Industry Stat (for individual industry pages) ────────

interface IndustryStatProps {
    /** Result from getEstablishments() */
    result: CensusEstablishmentResult;
    /** Plural noun, e.g. "physician offices" */
    plural: string;
    /** Optional audience-specific framing */
    audienceFrame?: 'owner' | 'contractor';
}

export function IndustryMarketStat({ result, plural, audienceFrame }: IndustryStatProps) {
    if (result.establishments === 0) return null;

    const count = result.establishments.toLocaleString();
    const area = result.areaLabel;

    // Frame copy differently for business owners vs contractors
    const copy = audienceFrame === 'contractor'
        ? `${count} ${plural} in ${area} need reliable cleaning partners.`
        : `${area} is home to ${count} ${plural} — each one responsible for their own facility maintenance.`;

    return (
        <div className="flex items-start gap-3 p-4 bg-sky-50/50 rounded-xl border border-sky-100">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </div>
            <div>
                <p className="text-sm text-slate-700 leading-relaxed">{copy}</p>
                <Citation
                    source={CENSUS_CITATION.source}
                    dataset={CENSUS_CITATION.dataset}
                    year={CENSUS_CITATION.year}
                    url={CENSUS_CITATION.baseUrl}
                    className="mt-1"
                />
            </div>
        </div>
    );
}
