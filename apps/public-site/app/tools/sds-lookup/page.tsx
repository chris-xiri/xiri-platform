'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, FileText, Shield, AlertTriangle, Leaf, ExternalLink, ArrowRight, BookOpen } from 'lucide-react';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { SDS_DATABASE } from '@/data/sds-database';
import type { SDSEntry } from '@/data/sds-types';
import { trackEvent } from '@/lib/tracking';

// ─── COMPONENT ─────────────────────────────────────────────────────

export default function SDSLookupPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterVOC, setFilterVOC] = useState<boolean | null>(null);
    const [filterGreen, setFilterGreen] = useState<boolean | null>(null);
    const [filterEpaListN, setFilterEpaListN] = useState<boolean | null>(null);
    const [filterSaferChoice, setFilterSaferChoice] = useState<boolean | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track tool view on mount
    useEffect(() => {
        trackEvent('tool_view', { tool: 'sds_lookup' });
    }, []);

    // Debounced search tracking
    const handleSearch = useCallback((value: string) => {
        setSearchTerm(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (value.length >= 3) {
            searchTimerRef.current = setTimeout(() => {
                trackEvent('tool_search', { tool: 'sds_lookup', query: value });
            }, 800);
        }
    }, []);

    // Track chemical expand
    const handleExpand = useCallback((entry: SDSEntry) => {
        const newExpanded = expanded === entry.id ? null : entry.id;
        setExpanded(newExpanded);
        if (newExpanded) {
            trackEvent('tool_result_expand', { tool: 'sds_lookup', chemical: entry.name, manufacturer: entry.manufacturer });
        }
    }, [expanded]);

    const filtered = useMemo(() => {
        return SDS_DATABASE.filter(entry => {
            const matchesSearch = !searchTerm ||
                entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
            const matchesVOC = filterVOC === null || entry.vocCompliant === filterVOC;
            const matchesGreen = filterGreen === null || entry.greenSealCertified === filterGreen;
            const matchesEpaListN = filterEpaListN === null || entry.epaListN === filterEpaListN;
            const matchesSaferChoice = filterSaferChoice === null || entry.epaSaferChoice === filterSaferChoice;
            return matchesSearch && matchesCategory && matchesVOC && matchesGreen && matchesEpaListN && matchesSaferChoice;
        });
    }, [searchTerm, filterCategory, filterVOC, filterGreen, filterEpaListN, filterSaferChoice]);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterCategory('all');
        setFilterVOC(null);
        setFilterGreen(null);
        setFilterEpaListN(null);
        setFilterSaferChoice(null);
    };

    const hasActiveFilters = searchTerm || filterCategory !== 'all' || filterVOC !== null || filterGreen !== null || filterEpaListN !== null || filterSaferChoice !== null;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Authority Funnel: Breadcrumb */}
            <AuthorityBreadcrumb items={[{ label: 'Tools', href: '/tools' }, { label: 'Chemical SDS Lookup' }]} />

            {/* ═══ HERO ═══ */}
            <section className="bg-slate-900 text-white py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold mb-6">
                        <FileText className="w-4 h-4" />
                        Free Chemical Reference Tool
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Cleaning Chemical SDS Lookup
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-6">
                        Look up Safety Data Sheets, VOC compliance, PPE requirements, and regulation notes for janitorial chemicals. No signup required.
                    </p>
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white text-sm font-semibold backdrop-blur-sm border border-white/20">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        {SDS_DATABASE.length} Chemicals Indexed — Cleaning & Facility Management
                    </div>
                </div>
            </section>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* ═══ SEARCH & FILTERS ═══ */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, manufacturer, or ingredient..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all text-slate-900"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mt-4">
                        <select
                            value={filterCategory}
                            onChange={e => { setFilterCategory(e.target.value); trackEvent('tool_filter', { tool: 'sds_lookup', filter: 'category', value: e.target.value }); }}
                            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white"
                        >
                            <option value="all">All Categories</option>
                            <option value="disinfectant">Disinfectants</option>
                            <option value="floor-care">Floor Care</option>
                            <option value="glass-surface">Glass & Surface</option>
                            <option value="restroom">Restroom</option>
                            <option value="degreaser">Degreasers</option>
                            <option value="specialty">Specialty</option>
                        </select>

                        <button
                            onClick={() => { const v = filterVOC === true ? null : true; setFilterVOC(v); trackEvent('tool_filter', { tool: 'sds_lookup', filter: 'voc_compliant', value: String(v) }); }}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterVOC === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-300'}`}
                        >
                            <Leaf className="w-3.5 h-3.5 inline mr-1" />
                            NYS VOC Compliant
                        </button>

                        <button
                            onClick={() => { const v = filterVOC === false ? null : false; setFilterVOC(v); trackEvent('tool_filter', { tool: 'sds_lookup', filter: 'voc_non_compliant', value: String(v) }); }}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterVOC === false ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-500 hover:border-red-300'}`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                            Non-Compliant
                        </button>

                        <button
                            onClick={() => setFilterGreen(filterGreen === true ? null : true)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterGreen === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-300'}`}
                        >
                            🏅 Green Seal Certified
                        </button>

                        <button
                            onClick={() => setFilterEpaListN(filterEpaListN === true ? null : true)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterEpaListN === true ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-blue-300'}`}
                        >
                            🦠 EPA List N (COVID-19)
                        </button>

                        <button
                            onClick={() => setFilterSaferChoice(filterSaferChoice === true ? null : true)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterSaferChoice === true ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-teal-300'}`}
                        >
                            🌿 EPA Safer Choice
                        </button>

                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-all"
                            >
                                ✕ Clear All
                            </button>
                        )}
                    </div>
                </div>

                {/* ═══ RESULTS COUNT ═══ */}
                <p className="text-sm text-slate-500 mb-6">{filtered.length} chemical{filtered.length !== 1 ? 's' : ''} found{hasActiveFilters ? ' (filtered)' : ''}</p>

                {/* ═══ CHEMICAL CARDS ═══ */}
                <div className="space-y-4">
                    {filtered.map(entry => {
                        const isExpanded = expanded === entry.id;
                        return (
                            <div key={entry.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header */}
                                <button
                                    onClick={() => handleExpand(entry)}
                                    className="w-full text-left p-6 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className="font-bold text-slate-900 text-lg">{entry.name}</h3>
                                                {entry.vocCompliant ? (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">VOC ✓</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">VOC ✗</span>
                                                )}
                                                {entry.greenSealCertified && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">Green Seal ✓</span>
                                                )}
                                                {entry.epaListN && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">EPA List N</span>
                                                )}
                                                {entry.epaSaferChoice && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700">Safer Choice</span>
                                                )}
                                                {entry.greenSealSaferList && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-lime-100 text-lime-700">GS Safer List</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                                <span>{entry.manufacturer}</span>
                                                <span>•</span>
                                                <span>{entry.categoryLabel}</span>
                                                <span>•</span>
                                                <span>Dwell: {entry.dwellTime}</span>
                                                {entry.epaRegNumber && (
                                                    <>
                                                        <span>•</span>
                                                        <span>EPA# {entry.epaRegNumber}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                            ▼
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Left Column */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Ingredient</h4>
                                                    <p className="text-slate-700">{entry.activeIngredient}</p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dilution Ratio</h4>
                                                    <p className="text-slate-700">{entry.dilutionRatio}</p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">VOC Content</h4>
                                                    <p className={`font-medium ${entry.vocCompliant ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {entry.vocGperL !== undefined ? `${entry.vocGperL} g/L` : 'Unknown'} — {entry.vocCompliant ? 'NYS Part 226 Compliant' : '⚠️ NOT NYS Part 226 Compliant'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hazards</h4>
                                                    <ul className="space-y-1">
                                                        {entry.hazards.map((h, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                                {h}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Right Column */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Required PPE</h4>
                                                    <ul className="space-y-1">
                                                        {entry.ppe.map((p, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                                                <Shield className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                                                                {p}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">First Aid</h4>
                                                    <p className="text-sm text-slate-600">{entry.firstAid}</p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Storage & Disposal</h4>
                                                    <p className="text-sm text-slate-600">{entry.storage} {entry.disposal}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Regulation Notes */}
                                        <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-200">
                                            <h4 className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">📋 Regulation Notes</h4>
                                            <p className="text-sm text-sky-800">{entry.regulationNotes}</p>
                                        </div>

                                        {/* SDS Link + References */}
                                        <div className="mt-4 flex flex-col sm:flex-row gap-4">
                                            {entry.sdsUrl && (
                                                <a
                                                    href={entry.sdsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => trackEvent('tool_external_click', { tool: 'sds_lookup', chemical: entry.name, url: entry.sdsUrl || '' })}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-colors"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    View Full SDS →
                                                </a>
                                            )}
                                        </div>

                                        {/* References */}
                                        {entry.references && entry.references.length > 0 && (
                                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    Sources & References
                                                </h4>
                                                <ul className="space-y-1">
                                                    {entry.references.map((ref, i) => (
                                                        <li key={i} className="text-sm">
                                                            <a
                                                                href={ref.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center gap-1"
                                                            >
                                                                <span className="px-1.5 py-0.5 bg-slate-200 rounded text-xs font-bold text-slate-600">{ref.authority}</span>
                                                                {ref.label}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ═══ EMPTY STATE ═══ */}
                {filtered.length === 0 && (
                    <div className="text-center py-16">
                        <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="font-bold text-slate-700 text-lg mb-2">No chemicals match your filters</h3>
                        <p className="text-slate-500 mb-4">Try adjusting your search or filters.</p>
                        <button onClick={clearFilters} className="text-sky-600 hover:text-sky-800 font-semibold text-sm">
                            Clear all filters →
                        </button>
                    </div>
                )}

                {/* ═══ CTA ═══ */}
                <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-center text-white">
                    <FileText className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-3">Need a Custom Chemical Program?</h3>
                    <p className="text-slate-300 mb-6 max-w-xl mx-auto">
                        XIRI builds regulation-compliant chemical programs for your facility — with SDS binders, VOC documentation, and EPA-registered products matched to your cleaning scope.
                    </p>
                    <Link
                        href="/#audit"
                        onClick={() => trackEvent('tool_cta_click', { tool: 'sds_lookup', cta: 'chemical_audit' })}
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-400 transition-colors"
                    >
                        Get a Free Chemical Audit →
                    </Link>
                </div>
            </div>

            {/* ═══ REGULATORY SOURCES FOOTER ═══ */}
            <section className="py-12 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Regulatory Sources</h2>
                    <p className="text-sm text-slate-500 text-center mb-6">
                        All chemical data verified against government and expert-association sources. XIRI does not host SDS documents — we link directly to manufacturer pages.
                    </p>
                    <div className="grid md:grid-cols-3 gap-4 mb-8">
                        {[
                            { label: 'EPA List N', url: 'https://www.epa.gov/pesticide-registration/disinfectants-coronavirus-covid-19', desc: 'COVID-19 Disinfectants' },
                            { label: 'OSHA BBP Standard', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030', desc: '29 CFR 1910.1030' },
                            { label: 'CDC Disinfection Guide', url: 'https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/', desc: 'Healthcare Facilities' },
                            { label: 'Green Seal Standards', url: 'https://greenseal.org/', desc: 'GS-37, GS-41, GS-53' },
                            { label: 'EPA Safer Choice', url: 'https://www.epa.gov/saferchoice', desc: 'Certified Products' },
                            { label: 'NYS DEC Part 226', url: 'https://www.dec.ny.gov/chemical/8569.html', desc: 'VOC Limits' },
                        ].map(s => (
                            <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 group-hover:text-sky-700">{s.label}</p>
                                    <p className="text-xs text-slate-400">{s.desc}</p>
                                </div>
                            </a>
                        ))}
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Related Compliance Resources</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {[
                            { href: '/tools/compliance-checker', name: 'Compliance Readiness Checker' },
                            { href: '/guides/osha-bloodborne-pathogen-cleaning-standard', name: 'OSHA BBP Standard Guide' },
                            { href: '/guides/nys-part-226-voc-cleaning-compliance', name: 'NYS Part 226 VOC Guide' },
                            { href: '/guides/hipaa-environmental-compliance-cleaning', name: 'HIPAA Environmental Guide' },
                            { href: '/guides/cms-conditions-for-coverage-cleaning', name: 'CMS Conditions for Coverage' },
                            { href: '/guides/aaahc-surgery-center-cleaning-standards', name: 'AAAHC Surgery Center Guide' },
                        ].map(g => (
                            <Link key={g.href} href={g.href} className="group flex items-center gap-2 text-sm text-slate-600 hover:text-sky-700 transition-colors">
                                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-sky-600" />
                                {g.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
