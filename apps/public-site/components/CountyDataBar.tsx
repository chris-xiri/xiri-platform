// ─── CountyDataBar ───────────────────────────────────────────────
// Compact, citation-backed stats bar for industry × location pages.
// Pulls data from open-data.ts at build time — zero runtime API calls.
//
// Shows: county population, median income, janitorial competitors,
// and the market-vs-regulation wage comparison.

import { Citation } from './Citation';
import {
    ACS_CITATION,
    CENSUS_CITATION,
    BLS_OEWS_CITATION,
} from '@/data/gov-data';
import {
    COUNTY_LABELS,
    type CountyId,
    type CountySummary,
    type MarketWageContext,
} from '@/data/open-data';

// ─── Types ───────────────────────────────────────────────────────

interface CountyDataBarProps {
    /** Pre-fetched county summary (demographics + competitors) */
    summary: CountySummary;
    /** Pre-fetched wage context (market vs min wage) */
    wageContext: MarketWageContext | null;
    /** Industry display name for contextual copy */
    industryName: string;
    /** Town name for localized copy */
    townName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function fmt(n: number): string {
    return n.toLocaleString('en-US');
}

function fmtCurrency(n: number): string {
    return '$' + n.toLocaleString('en-US');
}

// ─── Component ───────────────────────────────────────────────────

export function CountyDataBar({
    summary,
    wageContext,
    industryName,
    townName,
}: CountyDataBarProps) {
    const hasWageData = wageContext && wageContext.medianHourly > 0;

    return (
        <section className="py-10 bg-white border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-8">
                    <p className="text-xs font-semibold text-sky-600 uppercase tracking-widest mb-1">
                        Market Intelligence
                    </p>
                    <h2 className="text-2xl font-bold text-slate-900">
                        {summary.id === 'nyc-metro'
                            ? 'New York Metro Area'
                            : `${COUNTY_LABELS[summary.id] ?? townName} Market Data`}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Serving {townName} and surrounding communities
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                    {/* Population */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-slate-900">
                            {summary.population >= 1_000_000
                                ? `${(summary.population / 1_000_000).toFixed(1)}M`
                                : `${fmt(summary.population)}`}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">County Population</p>
                    </div>

                    {/* Median Income */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-slate-900">
                            {fmtCurrency(summary.medianIncome)}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Median Household Income</p>
                    </div>

                    {/* Total Businesses */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-sky-700">
                            {fmt(summary.totalBusinesses)}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Business Establishments</p>
                    </div>

                    {/* Janitorial Competitors */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
                        <p className="text-2xl md:text-3xl font-bold text-amber-600">
                            {fmt(summary.janitorialCompetitors)}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Registered Cleaning Firms</p>
                    </div>
                </div>

                {/* Citations Row */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mb-8">
                    <Citation
                        source={ACS_CITATION.source}
                        dataset={ACS_CITATION.dataset}
                        year={ACS_CITATION.year}
                        url={ACS_CITATION.baseUrl}
                    />
                    <Citation
                        source={CENSUS_CITATION.source}
                        dataset={CENSUS_CITATION.dataset}
                        year={CENSUS_CITATION.year}
                        url={CENSUS_CITATION.baseUrl}
                    />
                </div>

                {/* Wage Context (Market vs Regulation) */}
                {hasWageData && (
                    <div className="bg-sky-50/70 rounded-xl p-6 border border-sky-100 max-w-3xl mx-auto">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 mb-1.5">
                                    Market Rate vs. Minimum Wage
                                </h3>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    The median hourly wage for janitorial workers in{' '}
                                    <strong>{wageContext!.areaTitle}</strong> is{' '}
                                    <strong className="text-sky-700">${wageContext!.medianHourly.toFixed(2)}/hr</strong>
                                    {' '}— that&apos;s{' '}
                                    <strong className="text-amber-600">
                                        {wageContext!.premiumPct}% above
                                    </strong>{' '}
                                    New York&apos;s ${wageContext!.minWage.toFixed(2)}/hr minimum wage.
                                    {' '}When a cleaning company bids your {industryName.toLowerCase()} contract
                                    below market rate, they&apos;re underpaying their crews — which means
                                    high turnover, inconsistent quality, and a new untrained team
                                    in your building every few weeks.
                                </p>

                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                                    <Citation
                                        source={BLS_OEWS_CITATION.source}
                                        dataset={BLS_OEWS_CITATION.dataset}
                                        year={BLS_OEWS_CITATION.year}
                                        url={BLS_OEWS_CITATION.baseUrl}
                                    />
                                    <Citation
                                        source="NY Dept. of Labor"
                                        dataset="Minimum Wage"
                                        year={2025}
                                        url="https://dol.ny.gov/minimum-wage-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
