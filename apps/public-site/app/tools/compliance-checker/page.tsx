'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, CheckCircle, AlertTriangle, XCircle, ArrowRight, Building2, ChevronRight } from 'lucide-react';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';

// ─── FACILITY TYPES ────────────────────────────────────────────────

const FACILITY_TYPES = [
    { id: 'medical-office', label: 'Medical Office', icon: '🏥' },
    { id: 'surgery-center', label: 'Surgery Center / ASC', icon: '🔬' },
    { id: 'urgent-care', label: 'Urgent Care', icon: '🚑' },
    { id: 'dialysis-center', label: 'Dialysis Center', icon: '💉' },
    { id: 'dental-office', label: 'Dental Office', icon: '🦷' },
    { id: 'veterinary-clinic', label: 'Veterinary Clinic', icon: '🐾' },
    { id: 'daycare', label: 'Daycare / Preschool', icon: '👶' },
    { id: 'commercial-office', label: 'Commercial Office', icon: '🏢' },
] as const;

type FacilityType = (typeof FACILITY_TYPES)[number]['id'];

// ─── REGULATION CHECKLIST DATA ─────────────────────────────────────

interface ChecklistItem {
    id: string;
    regulation: string;
    requirement: string;
    description: string;
    guideSlug: string;
    guideName: string;
    severity: 'critical' | 'major' | 'minor';
}

const REGULATION_CHECKLISTS: Record<FacilityType, ChecklistItem[]> = {
    'medical-office': [
        { id: 'osha-ecp', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Written Exposure Control Plan', description: 'Do you have a current Exposure Control Plan (ECP) reviewed within the last 12 months?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-ppe', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'PPE for Cleaning Staff', description: 'Does your cleaning vendor provide gloves, face protection and fluid-resistant gowns for staff handling regulated waste?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-training', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Annual BBP Training', description: 'Have all cleaning staff completed Bloodborne Pathogen training within the last 12 months?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'hipaa-baa', regulation: 'HIPAA 45 CFR 164.502(e)', requirement: 'Business Associate Agreement', description: 'Has your cleaning company signed a HIPAA Business Associate Agreement (BAA)?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'critical' },
        { id: 'hipaa-phi', regulation: 'HIPAA 45 CFR 164.530', requirement: 'PHI Safeguards', description: 'Are cleaning staff trained to avoid reading, photographing or improperly disposing of patient health information left visible during after-hours cleaning?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'major' },
        { id: 'nys-voc', regulation: 'NYS 6 NYCRR Part 226', requirement: 'VOC-Compliant Products', description: 'Are all cleaning products used in your facility compliant with New York State VOC limits?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
        { id: 'nys-sds', regulation: 'OSHA HazCom / NYS Part 226', requirement: 'SDS Binder On-Site', description: 'Does your cleaning vendor maintain a current Safety Data Sheet (SDS) binder for all products used in your facility?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
    ],
    'surgery-center': [
        { id: 'aaahc-env', regulation: 'AAAHC Chapter 7', requirement: 'Environmental Safety Program', description: 'Do you maintain a written Environmental Safety management program that addresses cleaning, sanitation, and waste management for all surgical suites?', guideSlug: 'aaahc-surgery-center-cleaning-standards', guideName: 'AAAHC Surgery Center Standards', severity: 'critical' },
        { id: 'aaahc-or', regulation: 'AAAHC Chapter 9', requirement: 'Terminal OR Cleaning Protocol', description: 'Do you have a documented terminal cleaning protocol for operating rooms between same-day and end-of-day procedures?', guideSlug: 'aaahc-surgery-center-cleaning-standards', guideName: 'AAAHC Surgery Center Standards', severity: 'critical' },
        { id: 'aaahc-audit', regulation: 'AAAHC Chapter 7', requirement: 'Cleaning Audit Trail', description: 'Do you maintain a documented audit trail for all cleaning activities that can be produced during an AAAHC survey?', guideSlug: 'aaahc-surgery-center-cleaning-standards', guideName: 'AAAHC Surgery Center Standards', severity: 'critical' },
        { id: 'osha-ecp-sc', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Written Exposure Control Plan', description: 'Do you have a current Exposure Control Plan (ECP) that covers all cleaning and environmental staff?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-waste-sc', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Regulated Waste Handling', description: 'Are red-bag biohazard containers, sharps containers, and regulated waste documentation properly maintained?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'hipaa-baa-sc', regulation: 'HIPAA 45 CFR 164.502(e)', requirement: 'Business Associate Agreement', description: 'Has your cleaning vendor signed a HIPAA BAA?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'critical' },
        { id: 'nys-voc-sc', regulation: 'NYS 6 NYCRR Part 226', requirement: 'VOC-Compliant Products', description: 'Are all cleaning products compliant with NYS VOC limits — especially disinfectants used in the OR?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
        { id: 'cms-sc', regulation: 'CMS CoP', requirement: 'CMS Conditions of Participation', description: 'If CMS-certified, does your cleaning program meet the Conditions of Participation for infection control?', guideSlug: 'cms-conditions-for-coverage-cleaning', guideName: 'CMS Conditions for Coverage', severity: 'critical' },
    ],
    'urgent-care': [
        { id: 'osha-ecp-uc', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Written Exposure Control Plan', description: 'Do you have a current ECP reviewed within the last 12 months?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-ppe-uc', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'PPE for Cleaning Staff', description: 'Is appropriate PPE provided for cleaning staff handling patient care areas and regulated waste?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'hipaa-baa-uc', regulation: 'HIPAA 45 CFR 164.502(e)', requirement: 'Business Associate Agreement', description: 'Has your cleaning company signed a HIPAA BAA?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'critical' },
        { id: 'hipaa-phi-uc', regulation: 'HIPAA', requirement: 'PHI Safeguards', description: 'Are cleaning staff trained to handle visible PHI during after-hours cleaning?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'major' },
        { id: 'nys-voc-uc', regulation: 'NYS 6 NYCRR Part 226', requirement: 'VOC-Compliant Products', description: 'Are all cleaning products used in your facility NYS Part 226 compliant?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
    ],
    'dialysis-center': [
        { id: 'cms-water', regulation: 'CMS 42 CFR §494.30', requirement: 'Water & Dialysate Quality', description: 'Does your cleaning program avoid cross-contamination with the water treatment system? Are cleaning chemicals stored separately from dialysis supplies?', guideSlug: 'cms-conditions-for-coverage-cleaning', guideName: 'CMS Conditions for Coverage', severity: 'critical' },
        { id: 'cms-ic', regulation: 'CMS 42 CFR §494.30', requirement: 'Infection Control Program', description: 'Does your cleaning vendor follow your facility\'s infection control policies, including station turnover protocols?', guideSlug: 'cms-conditions-for-coverage-cleaning', guideName: 'CMS Conditions for Coverage', severity: 'critical' },
        { id: 'cms-doc', regulation: 'CMS 42 CFR §494.30', requirement: 'Cleaning Documentation', description: 'Are cleaning activities documented with timestamps that can be reviewed during CMS surveys?', guideSlug: 'cms-conditions-for-coverage-cleaning', guideName: 'CMS Conditions for Coverage', severity: 'critical' },
        { id: 'osha-bbp-dc', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Bloodborne Pathogen Protocol', description: 'Are biohazard containment and disposal protocols strictly followed for blood-contaminated waste?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'hipaa-baa-dc', regulation: 'HIPAA', requirement: 'Business Associate Agreement', description: 'Has your cleaning vendor signed a HIPAA BAA?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'major' },
        { id: 'nys-voc-dc', regulation: 'NYS Part 226', requirement: 'VOC-Compliant Products', description: 'Are cleaning products NYS Part 226 VOC-compliant?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
    ],
    'dental-office': [
        { id: 'osha-ecp-d', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Written Exposure Control Plan', description: 'Do you have a current ECP for your dental office?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-ppe-d', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'PPE for Cleaning Staff', description: 'Is PPE provided for cleaning operatories and sterilization areas?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'hipaa-baa-d', regulation: 'HIPAA', requirement: 'Business Associate Agreement', description: 'Has your cleaning company signed a HIPAA BAA?', guideSlug: 'hipaa-environmental-compliance-cleaning', guideName: 'HIPAA Environmental Compliance', severity: 'major' },
        { id: 'nys-voc-d', regulation: 'NYS Part 226', requirement: 'VOC-Compliant Products', description: 'Are products used in your facility NYS Part 226 compliant?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'minor' },
    ],
    'veterinary-clinic': [
        { id: 'osha-ecp-v', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Exposure Control Plan', description: 'Do you have an ECP covering animal blood, surgical waste, and zoonotic disease protocols?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'critical' },
        { id: 'osha-waste-v', regulation: 'OSHA 29 CFR 1910.1030', requirement: 'Regulated Waste Disposal', description: 'Is animal surgical waste properly separated and disposed of?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'major' },
        { id: 'nys-voc-v', regulation: 'NYS Part 226', requirement: 'VOC-Compliant Products', description: 'Are cleaning products VOC-compliant per NYS Part 226?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'minor' },
    ],
    'daycare': [
        { id: 'cdc-green', regulation: 'CDC / Green Seal', requirement: 'Non-Toxic Cleaning Products', description: 'Are all cleaning products used in child-occupied areas non-toxic and Green Seal (or equivalent) certified?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'critical' },
        { id: 'nys-voc-dc2', regulation: 'NYS Part 226', requirement: 'VOC-Compliant Products', description: 'Are all products within NYS Part 226 VOC limits — especially aerosols used in bathrooms and changing areas?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'critical' },
        { id: 'nys-sds-dc2', regulation: 'OSHA HazCom', requirement: 'SDS Binder On-Site', description: 'Is a current SDS binder maintained and accessible to staff?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'major' },
    ],
    'commercial-office': [
        { id: 'osha-haz', regulation: 'OSHA HazCom', requirement: 'Chemical Safety Program', description: 'Does your cleaning vendor maintain a Hazard Communication program with SDS for all chemicals used?', guideSlug: 'osha-bloodborne-pathogen-cleaning-standard', guideName: 'OSHA BBP Standard', severity: 'major' },
        { id: 'nys-voc-co', regulation: 'NYS Part 226', requirement: 'VOC-Compliant Products', description: 'Are products used in your facility NYS Part 226 compliant?', guideSlug: 'nys-part-226-voc-cleaning-compliance', guideName: 'NYS Part 226 VOC Compliance', severity: 'minor' },
    ],
};

// ─── SCORING ───────────────────────────────────────────────────────

type Status = 'compliant' | 'partial' | 'non-compliant' | 'unanswered';

function computeScore(answers: Record<string, Status>, items: ChecklistItem[]) {
    let total = 0;
    let earned = 0;
    for (const item of items) {
        const weight = item.severity === 'critical' ? 3 : item.severity === 'major' ? 2 : 1;
        total += weight;
        const a = answers[item.id] || 'unanswered';
        if (a === 'compliant') earned += weight;
        else if (a === 'partial') earned += weight * 0.5;
    }
    return total > 0 ? Math.round((earned / total) * 100) : 0;
}

function scoreColor(score: number) {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
}

function scoreBg(score: number) {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}

function scoreLabel(score: number) {
    if (score >= 80) return 'Strong Compliance';
    if (score >= 50) return 'Needs Improvement';
    return 'At Risk';
}

// ─── COMPONENT ─────────────────────────────────────────────────────

export default function ComplianceCheckerPage() {
    const [facility, setFacility] = useState<FacilityType | null>(null);
    const [answers, setAnswers] = useState<Record<string, Status>>({});
    const [showResults, setShowResults] = useState(false);

    const checklist = facility ? REGULATION_CHECKLISTS[facility] : [];
    const score = computeScore(answers, checklist);
    const answeredCount = Object.values(answers).filter(a => a !== 'unanswered').length;

    const setAnswer = (id: string, status: Status) => {
        setAnswers(prev => ({ ...prev, [id]: status }));
    };

    const reset = () => {
        setFacility(null);
        setAnswers({});
        setShowResults(false);
    };

    // Get unique guides referenced by non-compliant items for recommendations
    const recommendations = showResults
        ? Array.from(
            new Map(
                checklist
                    .filter(item => {
                        const a = answers[item.id] || 'unanswered';
                        return a !== 'compliant';
                    })
                    .map(item => [item.guideSlug, item])
            ).values()
        )
        : [];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Authority Funnel: Breadcrumb */}
            <AuthorityBreadcrumb items={[{ label: 'Tools', href: '/tools' }, { label: 'Compliance Readiness Checker' }]} />

            {/* ═══ HERO ═══ */}
            <section className="bg-slate-900 text-white py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/20 text-sky-300 text-sm font-bold mb-6">
                        <Shield className="w-4 h-4" />
                        Free Compliance Tool
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Facility Compliance Readiness Checker
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                        Assess your facility&apos;s cleaning compliance across OSHA, HIPAA, CMS, AAAHC, and NYS regulations in under 3 minutes. No signup required.
                    </p>
                </div>
            </section>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* ═══ STEP 1: FACILITY TYPE ═══ */}
                {!facility && (
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Step 1: Select Your Facility Type</h2>
                        <p className="text-slate-500 mb-8">We&apos;ll show you only the regulations that apply to your facility.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {FACILITY_TYPES.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => { setFacility(f.id); setAnswers({}); setShowResults(false); }}
                                    className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-sky-400 hover:shadow-lg transition-all text-center group"
                                >
                                    <div className="text-3xl mb-3">{f.icon}</div>
                                    <div className="font-bold text-slate-800 group-hover:text-sky-700 text-sm">{f.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ STEP 2: CHECKLIST ═══ */}
                {facility && !showResults && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Step 2: Compliance Self-Assessment</h2>
                                <p className="text-slate-500 mt-1">
                                    {answeredCount} of {checklist.length} answered
                                </p>
                            </div>
                            <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 underline">
                                Start over
                            </button>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-8">
                            <div
                                className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(answeredCount / checklist.length) * 100}%` }}
                            />
                        </div>

                        <div className="space-y-4">
                            {checklist.map(item => {
                                const current = answers[item.id] || 'unanswered';
                                return (
                                    <div key={item.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`px-2 py-0.5 rounded text-xs font-bold ${item.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                item.severity === 'major' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {item.severity.toUpperCase()}
                                            </div>
                                            <span className="text-xs text-slate-400 font-mono">{item.regulation}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 mb-1">{item.requirement}</h3>
                                        <p className="text-slate-600 text-sm mb-4">{item.description}</p>
                                        <div className="flex gap-2">
                                            {([
                                                { status: 'compliant' as Status, label: 'Yes', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
                                                { status: 'partial' as Status, label: 'Partial', icon: AlertTriangle, color: 'bg-amber-50 text-amber-700 border-amber-300' },
                                                { status: 'non-compliant' as Status, label: 'No', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-300' },
                                            ]).map(opt => (
                                                <button
                                                    key={opt.status}
                                                    onClick={() => setAnswer(item.id, opt.status)}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${current === opt.status
                                                        ? opt.color + ' shadow-sm'
                                                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <opt.icon className="w-4 h-4" />
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setShowResults(true)}
                                disabled={answeredCount === 0}
                                className="bg-sky-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-200"
                            >
                                See My Compliance Score →
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 3: RESULTS ═══ */}
                {showResults && (
                    <div>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">Your Compliance Score</h2>
                            <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 underline">
                                Start over
                            </button>
                        </div>

                        {/* Score card */}
                        <div className={`rounded-2xl p-8 border-2 mb-10 text-center ${scoreBg(score)}`}>
                            <div className={`text-7xl font-black ${scoreColor(score)}`}>{score}%</div>
                            <div className={`text-xl font-bold mt-2 ${scoreColor(score)}`}>{scoreLabel(score)}</div>
                            <p className="text-slate-600 mt-3 max-w-xl mx-auto">
                                {score >= 80
                                    ? 'Your facility\'s cleaning program meets most regulatory requirements. Review the items below to close any remaining gaps.'
                                    : score >= 50
                                        ? 'Your cleaning program has notable compliance gaps that could be flagged during a survey or audit. Address the critical items below first.'
                                        : 'Your facility has significant compliance risks. Any of the critical items below could result in citations, fines, or accreditation issues during a survey.'}
                            </p>
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-3 mb-10">
                            {checklist.map(item => {
                                const a = answers[item.id] || 'unanswered';
                                const StatusIcon = a === 'compliant' ? CheckCircle : a === 'partial' ? AlertTriangle : a === 'non-compliant' ? XCircle : AlertTriangle;
                                const statusColor = a === 'compliant' ? 'text-emerald-600' : a === 'partial' ? 'text-amber-600' : a === 'non-compliant' ? 'text-red-600' : 'text-slate-400';
                                return (
                                    <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg p-4 border border-slate-200">
                                        <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusColor}`} />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 text-sm">{item.requirement}</div>
                                            <div className="text-xs text-slate-400">{item.regulation}</div>
                                        </div>
                                        {a !== 'compliant' && (
                                            <Link
                                                href={`/guides/${item.guideSlug}`}
                                                className="text-xs text-sky-600 hover:underline flex items-center gap-1"
                                            >
                                                Fix this <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Recommendations */}
                        {recommendations.length > 0 && (
                            <div className="mb-10">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">📋 Recommended Guides</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {recommendations.map(item => (
                                        <Link
                                            key={item.guideSlug}
                                            href={`/guides/${item.guideSlug}`}
                                            className="group block bg-white rounded-xl p-5 border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{item.guideName}</h4>
                                                    <p className="text-sm text-slate-500 mt-1">{item.regulation}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA */}
                        <div className="bg-slate-900 rounded-2xl p-8 text-center text-white">
                            <Building2 className="w-10 h-10 text-sky-400 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold mb-3">Want Expert Help Closing These Gaps?</h3>
                            <p className="text-slate-300 mb-6 max-w-xl mx-auto">
                                XIRI deploys regulation-trained, $1M-insured cleaning contractors who handle OSHA, HIPAA, CMS, and AAAHC compliance so you don&apos;t have to.
                            </p>
                            <Link
                                href="/#audit"
                                className="inline-block bg-sky-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-400 transition-colors"
                            >
                                Get a Free Compliance Audit →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ TRUST / SEO FOOTER ═══ */}
            <section className="py-12 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Explore Our Compliance Guides</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {[
                            { slug: 'osha-bloodborne-pathogen-cleaning-standard', name: 'OSHA BBP Standard' },
                            { slug: 'hipaa-environmental-compliance-cleaning', name: 'HIPAA Environmental Compliance' },
                            { slug: 'nys-part-226-voc-cleaning-compliance', name: 'NYS Part 226 VOC Compliance' },
                            { slug: 'cms-conditions-for-coverage-cleaning', name: 'CMS Conditions for Coverage' },
                            { slug: 'aaahc-surgery-center-cleaning-standards', name: 'AAAHC Surgery Center Standards' },
                            { slug: 'jcaho-cleaning-requirements', name: 'JCAHO Cleaning Requirements' },
                        ].map(g => (
                            <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex items-center gap-2 text-sm text-slate-600 hover:text-sky-700 transition-colors">
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
