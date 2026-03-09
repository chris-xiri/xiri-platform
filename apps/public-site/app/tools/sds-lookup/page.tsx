'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, FileText, Shield, AlertTriangle, Leaf, ExternalLink, ArrowRight } from 'lucide-react';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';

// ─── CHEMICAL SDS DATABASE ────────────────────────────────────────

interface SDSEntry {
    id: string;
    name: string;
    manufacturer: string;
    category: 'disinfectant' | 'floor-care' | 'glass-surface' | 'restroom' | 'degreaser' | 'specialty';
    categoryLabel: string;
    activeIngredient: string;
    epaRegNumber?: string;
    vocCompliant: boolean;
    vocGperL?: number;
    greenSealCertified: boolean;
    dilutionRatio: string;
    dwellTime: string;
    hazards: string[];
    ppe: string[];
    firstAid: string;
    storage: string;
    disposal: string;
    suitableFor: string[];
    notSuitableFor: string[];
    regulationNotes: string;
}

const SDS_DATABASE: SDSEntry[] = [
    {
        id: 'virex-ii-256',
        name: 'Virex II 256 One-Step Disinfectant',
        manufacturer: 'Diversey',
        category: 'disinfectant',
        categoryLabel: 'Hospital-Grade Disinfectant',
        activeIngredient: 'Quaternary Ammonium (Didecyl dimethyl ammonium chloride)',
        epaRegNumber: '70627-24',
        vocCompliant: true,
        vocGperL: 12,
        greenSealCertified: false,
        dilutionRatio: '1:256 (½ oz per gallon)',
        dwellTime: '10 minutes',
        hazards: ['Corrosive to eyes', 'Harmful if swallowed', 'Skin irritant at concentrate'],
        ppe: ['Chemical splash goggles', 'Chemical-resistant gloves', 'Apron when handling concentrate'],
        firstAid: 'Eyes: Flush with water 15 min. Skin: Wash with soap and water. Ingestion: Do not induce vomiting, call Poison Control.',
        storage: 'Store in original container in a cool, dry area. Keep from freezing.',
        disposal: 'Rinse empty container and dispose per local regulations. Do not reuse container.',
        suitableFor: ['medical-office', 'surgery-center', 'urgent-care', 'dialysis-center', 'dental-office'],
        notSuitableFor: ['daycare', 'food-prep'],
        regulationNotes: 'EPA-registered hospital-grade disinfectant. Meets OSHA BBP requirements for blood and OPIM cleanup. NYS Part 226 compliant at 12 g/L VOC.',
    },
    {
        id: 'oxivir-tb',
        name: 'Oxivir TB RTU Disinfectant Cleaner',
        manufacturer: 'Diversey',
        category: 'disinfectant',
        categoryLabel: 'AHP Disinfectant',
        activeIngredient: 'Hydrogen Peroxide (Accelerated)',
        epaRegNumber: '70627-56',
        vocCompliant: true,
        vocGperL: 5,
        greenSealCertified: true,
        dilutionRatio: 'Ready to Use (no dilution)',
        dwellTime: '1 minute (TB claim)',
        hazards: ['Low toxicity', 'Mild eye irritant'],
        ppe: ['Safety glasses', 'Gloves recommended'],
        firstAid: 'Eyes: Flush with water 5 min. Skin: Rinse with water. Minimal hazard at use dilution.',
        storage: 'Room temperature. Avoid extreme heat.',
        disposal: 'Rinsate can be disposed of in sanitary sewer. Empty container is not hazardous waste.',
        suitableFor: ['medical-office', 'surgery-center', 'urgent-care', 'daycare', 'dental-office', 'veterinary-clinic'],
        notSuitableFor: [],
        regulationNotes: 'EPA-registered hospital-grade. Green Seal certified (GS-53). Only 1-min dwell time — ideal for high-throughput surgical turnover. NYS Part 226 compliant.',
    },
    {
        id: 'clorox-healthcare-bleach',
        name: 'Clorox Healthcare Bleach Germicidal Cleaner',
        manufacturer: 'Clorox Professional',
        category: 'disinfectant',
        categoryLabel: 'Bleach-Based Disinfectant',
        activeIngredient: 'Sodium Hypochlorite (0.55%)',
        epaRegNumber: '56392-7',
        vocCompliant: true,
        vocGperL: 0,
        greenSealCertified: false,
        dilutionRatio: 'Ready to Use',
        dwellTime: '1 minute (bloodborne pathogen)',
        hazards: ['Corrosive to eyes', 'Skin irritant', 'Releases chlorine gas if mixed with ammonia or acids'],
        ppe: ['Chemical splash goggles', 'Chemical-resistant gloves', 'Ventilation in enclosed areas'],
        firstAid: 'Eyes: Flush 15 min. Ingestion: Drink water, do not induce vomiting. Inhalation: Move to fresh air.',
        storage: 'Store upright in cool, dry area. Do not mix with other chemicals.',
        disposal: 'Flush down drain with water. Do not reuse container.',
        suitableFor: ['surgery-center', 'dialysis-center', 'urgent-care'],
        notSuitableFor: ['daycare', 'areas-with-metal-surfaces'],
        regulationNotes: 'Meets CDC recommendations for C. diff and Norovirus. 1-min BBP kill claim meets OSHA. Can damage stainless steel with prolonged contact.',
    },
    {
        id: 'enmotion-foam-soap',
        name: 'enMotion Foam Soap with Moisturizers',
        manufacturer: 'GP PRO (Georgia-Pacific)',
        category: 'restroom',
        categoryLabel: 'Hand Soap',
        activeIngredient: 'Cocamidopropyl Betaine (surfactant)',
        vocCompliant: true,
        vocGperL: 0,
        greenSealCertified: true,
        dilutionRatio: 'Ready to Use (cartridge)',
        dwellTime: '20 seconds (CDC hand hygiene)',
        hazards: ['Mild eye irritant'],
        ppe: ['None required for normal use'],
        firstAid: 'Eyes: Rinse with water. Generally non-hazardous.',
        storage: 'Room temperature. Keep sealed until use.',
        disposal: 'Empty cartridge is non-hazardous waste.',
        suitableFor: ['medical-office', 'surgery-center', 'daycare', 'commercial-office', 'dental-office'],
        notSuitableFor: [],
        regulationNotes: 'Green Seal certified. Supports CDC hand hygiene guidelines. Fragrance-free options available for sensitive healthcare environments.',
    },
    {
        id: 'betco-ph7-ultra',
        name: 'Betco pH7 Ultra Neutral Floor Cleaner',
        manufacturer: 'Betco Corporation',
        category: 'floor-care',
        categoryLabel: 'Neutral Floor Cleaner',
        activeIngredient: 'Nonionic Surfactants',
        vocCompliant: true,
        vocGperL: 8,
        greenSealCertified: true,
        dilutionRatio: '1:128 (1 oz per gallon)',
        dwellTime: 'N/A — mop and go',
        hazards: ['Mild eye irritant at concentrate'],
        ppe: ['Gloves when handling concentrate'],
        firstAid: 'Eyes: Flush with water. Skin: Wash with water. Low hazard.',
        storage: 'Store in original container. Keep from freezing.',
        disposal: 'Diluted solution safe for sewer. Empty container is recyclable.',
        suitableFor: ['medical-office', 'commercial-office', 'daycare', 'dental-office', 'surgery-center'],
        notSuitableFor: [],
        regulationNotes: 'Green Seal GS-37 certified. Safe on all resilient and hard floor types. Will not damage floor finish. NYS Part 226 compliant.',
    },
    {
        id: 'spartan-biorenewables-glass',
        name: 'Spartan BioRenewables Glass Cleaner',
        manufacturer: 'Spartan Chemical',
        category: 'glass-surface',
        categoryLabel: 'Glass & Surface Cleaner',
        activeIngredient: 'Bio-based surfactants (corn & soy derived)',
        vocCompliant: true,
        vocGperL: 3,
        greenSealCertified: true,
        dilutionRatio: '1:64 (2 oz per gallon)',
        dwellTime: 'Spray and wipe',
        hazards: ['Minimal — mild eye irritant'],
        ppe: ['Safety glasses recommended'],
        firstAid: 'Eyes: Flush with water. Non-toxic.',
        storage: 'Room temperature. Keep sealed.',
        disposal: 'Biodegradable. Non-hazardous waste.',
        suitableFor: ['medical-office', 'commercial-office', 'daycare', 'dental-office'],
        notSuitableFor: [],
        regulationNotes: 'USDA BioPreferred product. Green Seal certified. Ideal for VOC-sensitive environments like daycares.',
    },
    {
        id: 'simple-green-d-pro-5',
        name: 'Simple Green d Pro 5 One-Step Disinfectant',
        manufacturer: 'Sunshine Makers',
        category: 'disinfectant',
        categoryLabel: 'One-Step Disinfectant',
        activeIngredient: 'Quaternary Ammonium Compounds',
        epaRegNumber: '3573-30',
        vocCompliant: true,
        vocGperL: 10,
        greenSealCertified: false,
        dilutionRatio: '1:30 (4.3 oz per gallon)',
        dwellTime: '10 minutes',
        hazards: ['Moderate eye irritant', 'Harmful if swallowed'],
        ppe: ['Safety glasses', 'Chemical-resistant gloves'],
        firstAid: 'Eyes: Flush 15 min. Skin: Wash thoroughly. Ingestion: Call Poison Control.',
        storage: 'Original container, cool dry area.',
        disposal: 'Per local/state regulations.',
        suitableFor: ['veterinary-clinic', 'commercial-office', 'medical-office'],
        notSuitableFor: ['daycare'],
        regulationNotes: 'EPA-registered hospital-grade. Kills HIV-1, HBV, HCV — meets OSHA BBP. Pleasant lemon fragrance. NYS Part 226 compliant.',
    },
    {
        id: 'zep-spirit-ii',
        name: 'Zep Spirit II Ready-to-Use Detergent Disinfectant',
        manufacturer: 'Zep Inc.',
        category: 'disinfectant',
        categoryLabel: 'RTU Disinfectant',
        activeIngredient: 'Quaternary Ammonium (Alkyl C12-16)',
        epaRegNumber: '1839-220',
        vocCompliant: false,
        vocGperL: 185,
        greenSealCertified: false,
        dilutionRatio: 'Ready to Use',
        dwellTime: '10 minutes',
        hazards: ['Moderate eye irritant', 'Skin irritant', 'High VOC content'],
        ppe: ['Chemical splash goggles', 'Gloves', 'Ventilation required'],
        firstAid: 'Eyes: Flush 15 min. Skin: Wash with soap and water. Inhalation: Move to fresh air.',
        storage: 'Original container. Do not expose to heat or flame.',
        disposal: 'Hazardous waste — dispose per RCRA guidelines.',
        suitableFor: ['commercial-office'],
        notSuitableFor: ['medical-office', 'surgery-center', 'daycare', 'dental-office'],
        regulationNotes: '⚠️ NOT NYS Part 226 compliant at 185 g/L VOC. Cannot be used in NYC or Long Island without violating VOC regulations. Not recommended for healthcare.',
    },
];

// ─── COMPONENT ─────────────────────────────────────────────────────

export default function SDSLookupPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterVOC, setFilterVOC] = useState<boolean | null>(null);
    const [filterGreen, setFilterGreen] = useState<boolean | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const filtered = useMemo(() => {
        return SDS_DATABASE.filter(entry => {
            const matchesSearch = !searchTerm ||
                entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
            const matchesVOC = filterVOC === null || entry.vocCompliant === filterVOC;
            const matchesGreen = filterGreen === null || entry.greenSealCertified === filterGreen;
            return matchesSearch && matchesCategory && matchesVOC && matchesGreen;
        });
    }, [searchTerm, filterCategory, filterVOC, filterGreen]);

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
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                        Look up Safety Data Sheets, VOC compliance, PPE requirements, and regulation notes for common janitorial chemicals. No signup required.
                    </p>
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
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all text-slate-900"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mt-4">
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
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
                            onClick={() => setFilterVOC(filterVOC === true ? null : true)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${filterVOC === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-300'}`}
                        >
                            <Leaf className="w-3.5 h-3.5 inline mr-1" />
                            NYS VOC Compliant
                        </button>

                        <button
                            onClick={() => setFilterVOC(filterVOC === false ? null : false)}
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
                    </div>
                </div>

                {/* ═══ RESULTS COUNT ═══ */}
                <p className="text-sm text-slate-500 mb-6">{filtered.length} chemical{filtered.length !== 1 ? 's' : ''} found</p>

                {/* ═══ CHEMICAL CARDS ═══ */}
                <div className="space-y-4">
                    {filtered.map(entry => {
                        const isExpanded = expanded === entry.id;
                        return (
                            <div key={entry.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header */}
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                                    className="w-full text-left p-6 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-slate-900 text-lg">{entry.name}</h3>
                                                {entry.vocCompliant ? (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">VOC ✓</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">VOC ✗</span>
                                                )}
                                                {entry.greenSealCertified && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">Green Seal ✓</span>
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
                        <p className="text-slate-500">Try adjusting your search or filters.</p>
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
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-400 transition-colors"
                    >
                        Get a Free Chemical Audit →
                    </Link>
                </div>
            </div>

            {/* ═══ SEO FOOTER ═══ */}
            <section className="py-12 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
