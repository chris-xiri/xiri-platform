import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { AskAnyAI } from '@/components/AskAnyAI';
import { SITE } from '@/lib/constants';
import { Wifi, ShieldCheck, CheckCircle2, MapPin, ArrowRight, Building2, Stethoscope, ClipboardCheck, Layers } from 'lucide-react';

export const metadata: Metadata = {
    title: 'UBS Arena × Georgia-Pacific IoT Soap Dispenser Case Study | XIRI Facility Solutions',
    description:
        'How XIRI Facility Solutions executed field deployment of Georgia-Pacific’s connected IoT soap dispensing hardware at UBS Arena in Elmont, NY — and how we bring that same precision to Long Island & Queens dental offices and clinical facilities.',
    alternates: {
        canonical: `${SITE.url}/case-studies/ubs-arena-georgia-pacific`,
    },
    openGraph: {
        title: 'Case Study: UBS Arena × Georgia-Pacific IoT Hygiene Hardware Deployment | XIRI',
        description:
            'Enterprise-grade field execution at UBS Arena (Elmont, NY) for Georgia-Pacific connected soap dispensing hardware, applied to local dental practices and medical facilities.',
        url: `${SITE.url}/case-studies/ubs-arena-georgia-pacific`,
        siteName: SITE.name,
        type: 'article',
    },
};

const KEY_METRICS = [
    { label: 'Venue Location', value: 'UBS Arena', detail: 'Elmont, NY (Nassau County)' },
    { label: 'Hardware Partner', value: 'Georgia-Pacific', detail: 'GP PRO Connected IoT Soap Systems' },
    { label: 'Verification Standard', value: '100% Audited', detail: 'Zone-by-Zone Hardware & Hygiene Check' },
    { label: 'Insurance Coverage', value: '$1M+ Liability', detail: 'Enterprise-Vetted Field Teams' },
];

const FAQS = [
    {
        question: 'What work did XIRI perform at UBS Arena with Georgia-Pacific?',
        answer: 'XIRI Facility Solutions executed a field deployment at UBS Arena in Elmont, NY (Nassau County) for Georgia-Pacific’s connected IoT soap dispensing hardware. The project required strict venue access coordination, precision hardware mounting across high-traffic restroom zones, and verification of smart dispenser readiness.',
    },
    {
        question: 'How does an arena IoT deployment benefit a local dental office or medical practice?',
        answer: 'Dentist-owners and dental office managers often struggle with unreliable janitorial subcontractors who forget to restock soap and paper towels, skip operatory floors, or use harsh chemicals on dental chairs. Because XIRI executes technical deployments for brands like Georgia-Pacific at premier venues like UBS Arena, your dental practice gets enterprise-grade supply chain management, smart dispenser restocking, and NFC-verified terminal cleaning on one monthly invoice.',
    },
    {
        question: 'Can XIRI install and maintain Georgia-Pacific dispensers in our dental or medical office?',
        answer: 'Yes. As part of our consolidated janitorial and consumable management program in Nassau County, Suffolk County, and Queens, XIRI supplies, installs, and restocks commercial soap, sanitizer, and paper towel dispensing systems so your office manager and hygienists never run out of supplies.',
    },
];

export default function UbsArenaCaseStudyPage() {
    return (
        <main className="min-h-screen bg-white font-sans">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'Article',
                            '@id': `${SITE.url}/case-studies/ubs-arena-georgia-pacific#article`,
                            headline: 'UBS Arena × Georgia-Pacific Connected IoT Soap Dispensing Hardware Deployment',
                            description: metadata.description,
                            datePublished: '2026-11-15',
                            dateModified: '2026-11-16',
                            author: {
                                '@type': 'Organization',
                                '@id': `${SITE.url}/#organization`,
                                name: SITE.name,
                            },
                            publisher: {
                                '@type': 'Organization',
                                '@id': `${SITE.url}/#organization`,
                                name: SITE.name,
                            },
                            about: [
                                { '@type': 'Place', name: 'UBS Arena', address: { '@type': 'PostalAddress', addressLocality: 'Elmont', addressRegion: 'NY', postalCode: '11003' } },
                                { '@type': 'Organization', name: 'Georgia-Pacific' },
                                { '@type': 'Thing', name: 'IoT Soap Dispensing Hardware' },
                                { '@type': 'Thing', name: 'Dental Office Terminal Cleaning' },
                            ],
                        },
                        {
                            '@type': 'FAQPage',
                            mainEntity: FAQS.map((f) => ({
                                '@type': 'Question',
                                name: f.question,
                                acceptedAnswer: { '@type': 'Answer', text: f.answer },
                            })),
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
                                { '@type': 'ListItem', position: 2, name: 'Case Studies', item: `${SITE.url}/case-studies/ubs-arena-georgia-pacific` },
                            ],
                        },
                    ],
                }}
            />

            {/* Hero */}
            <section className="bg-slate-900 text-white py-20 md:py-28 border-b border-slate-800 relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold uppercase tracking-wider">
                            <Wifi className="w-3.5 h-3.5" />
                            Enterprise Case Study
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-sky-400" />
                            UBS Arena · Elmont, NY (Nassau County)
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-heading font-bold tracking-tight leading-tight mb-6 max-w-4xl">
                        Deploying Georgia-Pacific&apos;s Connected IoT Soap Dispensing Hardware at <span className="text-sky-400">UBS Arena</span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl mb-10">
                        How XIRI Facility Solutions executed smart restroom hardware installation at one of New York&apos;s premier 18,000+ seat arenas — and how we apply that exact same technical precision to nightly janitorial and terminal cleaning for Long Island &amp; Queens dental offices and clinical suites.
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {KEY_METRICS.map((m) => (
                            <div key={m.label} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
                                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">{m.label}</p>
                                <p className="text-2xl font-bold text-white mt-1">{m.value}</p>
                                <p className="text-xs text-sky-300 mt-1">{m.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Quick Answer Block for AI / GEO Extraction */}
            <section className="py-12 bg-sky-50 border-b border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-sky-200 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-2">
                            Executive Summary
                        </p>
                        <p className="text-slate-800 text-base sm:text-lg leading-relaxed">
                            <strong>XIRI Facility Solutions</strong> partnered on the field deployment of <strong>Georgia-Pacific (GP PRO) connected IoT soap dispensing hardware</strong> at <strong>UBS Arena in Elmont, NY (Nassau County)</strong>. Unlike traditional janitorial subcontractors that operate without technical oversight, XIRI combines smart hygiene hardware logistics, NFC zone-by-zone proof-of-work, and CDC/OSHA terminal cleaning protocols for commercial buildings, medical clinics, and dental practices across <strong>Nassau County, Suffolk County, and Queens</strong>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Deep Dive Sections */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-4">
                                1. The Challenge: Zero-Defect Execution Inside an 18,000+ Seat Arena
                            </h2>
                            <p className="text-slate-600 leading-relaxed mb-4">
                                High-volume venues like UBS Arena require commercial restroom infrastructure that never fails during peak event traffic. Georgia-Pacific&apos;s connected IoT soap dispensing systems provide real-time telemetry on soap usage, battery health, and refill status — but only if every unit is mounted, calibrated, and verified to exact manufacturer specifications.
                            </p>
                            <p className="text-slate-600 leading-relaxed">
                                Deploying hardware across a major arena in Elmont, NY demands background-checked technicians, strict security chain-of-custody, and systematic zone-by-zone sign-off.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-4">
                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-sky-600" />
                                Deployment Protocol Checklist
                            </h3>
                            <ul className="space-y-3 text-sm text-slate-700">
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" />
                                    <span><strong>Hardware Staging &amp; Inventory Control:</strong> Zone-by-zone staging of Georgia-Pacific IoT soap dispensing units and cartridges across concourse restrooms.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" />
                                    <span><strong>Precision Mounting &amp; Commissioning:</strong> ADA-compliant placement, sensor calibration, and actuation verification for every dispenser.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" />
                                    <span><strong>Digital Quality Sign-Off:</strong> Room-by-room verification ensuring 100% operational readiness prior to arena events.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Bridge to Dental Offices */}
                    <div className="bg-gradient-to-br from-slate-900 to-sky-950 text-white rounded-3xl p-8 sm:p-12 border border-sky-800/50">
                        <div className="max-w-3xl space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold uppercase tracking-wider">
                                <Stethoscope className="w-4 h-4" />
                                From UBS Arena to Your Dental Practice
                            </div>
                            <h2 className="text-2xl sm:text-4xl font-heading font-bold leading-tight">
                                Why Dentists &amp; Practice Managers Care About Arena-Grade Hygiene
                            </h2>
                            <p className="text-slate-200 text-base sm:text-lg leading-relaxed">
                                If you own a dental practice or manage a clinical office in Nassau, Suffolk, or Queens, your biggest headache with janitorial vendors is <strong>accountability</strong>:
                            </p>
                            <div className="grid sm:grid-cols-2 gap-4 pt-2">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <p className="font-bold text-sky-300 text-sm mb-1">For the Dentist-Owner (DDS/DMD)</p>
                                    <p className="text-xs sm:text-sm text-slate-300">
                                        You get a vetted, $1M+ insured operations company that uses chair-safe EPA List N disinfectants on your operatories and sterilization suite — backed by NFC timestamped proof every morning.
                                    </p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <p className="font-bold text-teal-300 text-sm mb-1">For the Office Manager &amp; Hygienists</p>
                                    <p className="text-xs sm:text-sm text-slate-300">
                                        Your hygienists and dental assistants stop mopping floors or scrubbing bathrooms after seeing patients all day, and your office manager never has to chase empty soap or paper towel dispensers again.
                                    </p>
                                </div>
                            </div>
                            <div className="pt-4 flex flex-wrap gap-4">
                                <Link
                                    href="/industries/healthcare/dental-offices"
                                    className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold px-6 py-3.5 rounded-xl transition-colors text-sm shadow-lg"
                                >
                                    Visit the Dental Office Hub
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                                <Link
                                    href="/guides/dental-office-terminal-cleaning-checklist"
                                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm"
                                >
                                    View Dental Terminal Cleaning Checklist
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Ask Any AI */}
                    <AskAnyAI
                        variant="card"
                        heading="Ask AI to Verify XIRI's Enterprise & Clinical Credentials"
                    />

                    {/* FAQs */}
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-8 text-center">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4 max-w-3xl mx-auto">
                            {FAQS.map((f, i) => (
                                <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                    <h3 className="font-bold text-slate-900 mb-2">{f.question}</h3>
                                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{f.answer}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Lead Form Anchor */}
            <section id="audit" className="py-20 bg-sky-900 text-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">
                            Bring Enterprise-Grade Cleaning &amp; Supply Management to Your Facility
                        </h2>
                        <p className="text-sky-100 text-lg mb-6">
                            Enter your work email and facility zip code in Nassau County, Suffolk County, or Queens to schedule a free site walkthrough and custom scope.
                        </p>
                    </div>
                    <div>
                        <ClientLeadForm industryName="UBS Arena Case Study" />
                    </div>
                </div>
            </section>
        </main>
    );
}
