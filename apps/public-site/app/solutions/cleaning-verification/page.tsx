import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { SITE, CTA } from '@/lib/constants';
import { CheckCircle, ArrowRight, Shield, Smartphone, FileCheck, Clock, Scan, Eye } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Cleaning Verification | NFC Proof of Work & Compliance Logs | XIRI',
    description:
        'Do you know if your building actually got cleaned last night? XIRI provides NFC-verified proof of work, digital compliance logs, and accountability for commercial cleaning — whether you keep your current cleaner or switch to us.',
    alternates: { canonical: `${SITE.url}/solutions/cleaning-verification` },
    openGraph: {
        title: 'Cleaning Verification — Proof Your Building Was Actually Cleaned',
        description:
            'NFC proof of work, zone-by-zone task verification, and digital compliance logs. The cleaning accountability system no other company offers.',
        url: `${SITE.url}/solutions/cleaning-verification`,
        siteName: SITE.name,
        type: 'website',
    },
};

/* ── Hub sub-pages ── */
const VERIFICATION_SOLUTIONS = [
    {
        slug: 'nfc-proof-of-work',
        title: 'NFC Proof of Work',
        description:
            'Tamper-proof check-ins using NFC tags mounted in every zone. Cleaners tap in, complete task checklists, and clock out — creating a timestamped record that can\'t be faked from the parking lot.',
        icon: Scan,
        color: 'sky',
    },
    {
        slug: 'digital-compliance-log',
        title: 'Digital Compliance Logs',
        description:
            'Every NFC scan auto-generates a compliance record. Inspectors, landlords, and corporate teams can access your log via a public URL — no logins, no binders.',
        icon: FileCheck,
        color: 'emerald',
    },
    {
        slug: 'keep-your-cleaner',
        title: 'Keep Your Cleaner, Add Accountability',
        description:
            'Don\'t want to switch vendors? We install NFC verification on top of your existing cleaning crew. You get proof of work without changing anything.',
        icon: Shield,
        color: 'amber',
    },
];

/* ── Related blog posts (accountability cluster) ── */
const RELATED_POSTS = [
    { slug: 'what-is-proof-of-work-in-cleaning', title: 'What Is Proof of Work in Commercial Cleaning?' },
    { slug: 'how-nfc-tags-prevent-cleaning-fraud', title: 'How NFC Tags Keep Cleaning Crews on Track' },
    { slug: 'paper-cleaning-logs-vs-nfc-verification', title: 'Paper Cleaning Logs vs. NFC Verification' },
    { slug: 'why-gps-tracking-doesnt-prove-cleaning', title: 'Why GPS Tracking Doesn\'t Prove Cleaning' },
    { slug: 'how-to-know-if-building-was-cleaned', title: 'How to Know If Your Building Was Actually Cleaned' },
    { slug: 'inspector-ready-cleaning-documentation', title: 'Inspector-Ready Cleaning Documentation' },
    { slug: 'things-your-cleaning-company-isnt-doing', title: 'Things Your Cleaning Company Isn\'t Doing' },
    { slug: 'osha-self-certification-cleaning-crews', title: 'OSHA Self-Certification for Cleaning Crews' },
    { slug: 'is-your-cleaning-company-cutting-corners', title: 'Is Your Cleaning Company Cutting Corners?' },
    { slug: 'why-cleaning-crews-miss-tasks', title: 'Why Cleaning Crews Miss Tasks (And How to Fix It)' },
];

/* ── How It Works steps ── */
const STEPS = [
    {
        num: 1,
        title: 'We install NFC tags in every zone',
        description: 'Restrooms, lobbies, exam rooms, break rooms — wherever cleaning happens, a tag goes in. Takes about 30 minutes per site.',
        icon: Smartphone,
    },
    {
        num: 2,
        title: 'Cleaners tap in to each zone',
        description: 'Your crew (or ours) taps the NFC tag with their phone when they enter a zone. A task checklist specific to that zone appears. No app download needed.',
        icon: Scan,
    },
    {
        num: 3,
        title: 'Tasks are completed and logged',
        description: 'Each task is checked off as completed. The system records who, what, when, and where — automatically. No manual entry, no paper forms.',
        icon: CheckCircle,
    },
    {
        num: 4,
        title: 'You see everything the next morning',
        description: 'Your compliance log updates in real time. Open your phone and see every zone, every task, and every timestamp from last night — or share the URL with anyone.',
        icon: Eye,
    },
];

export default function CleaningVerificationHub() {
    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebPage',
                    name: 'Cleaning Verification — NFC Proof of Work & Compliance Logs',
                    description: metadata.description,
                    url: `${SITE.url}/solutions/cleaning-verification`,
                    breadcrumb: {
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
                            { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${SITE.url}/solutions` },
                            { '@type': 'ListItem', position: 3, name: 'Cleaning Verification' },
                        ],
                    },
                }}
            />

            {/* ══════ HERO ══════ */}
            <section className="pt-32 pb-20 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(14,165,233,0.15),transparent_60%)]" />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <p className="text-sm font-bold text-sky-400 tracking-widest uppercase mb-4">Cleaning Verification</p>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
                        Do you know if your building<br className="hidden sm:block" /> actually got cleaned last night?
                    </h1>
                    <p className="text-xl text-sky-100 max-w-2xl mx-auto mb-10">
                        NFC-verified proof of work, digital compliance logs, and the option to keep your existing cleaner while adding accountability. The verification system no other cleaning company offers.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/#audit"
                            className="inline-flex items-center justify-center bg-white text-sky-900 px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-sky-50 transition-all"
                        >
                            {CTA.primary}
                        </Link>
                        <Link
                            href="/solutions/keep-your-cleaner"
                            className="inline-flex items-center justify-center border-2 border-sky-400 text-sky-100 px-8 py-4 rounded-full text-lg font-bold hover:bg-sky-800/50 transition-all"
                        >
                            Keep Your Cleaner →
                        </Link>
                    </div>
                </div>
            </section>

            {/* ══════ THE PROBLEM ══════ */}
            <section className="py-20 bg-slate-50 border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">The Accountability Gap in Commercial Cleaning</h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl mx-auto">
                        Every night, someone has unsupervised access to your facility. Your only evidence it got cleaned is the absence of complaints the next morning.
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            { label: 'Paper sign-in sheets', problem: 'Can be forged, backdated, or left blank. Inspectors know this.' },
                            { label: 'GPS tracking', problem: 'Proves the van was in the parking lot. Doesn\'t prove they cleaned every restroom.' },
                            { label: 'Self-reported checklists', problem: 'The person reporting is the person being evaluated. No independence.' },
                            { label: 'Invoices as proof', problem: 'An invoice proves you paid. It doesn\'t prove they performed.' },
                        ].map((item, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200">
                                <p className="font-bold text-red-600 mb-2">❌ {item.label}</p>
                                <p className="text-slate-600">{item.problem}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════ HOW IT WORKS ══════ */}
            <section className="py-20 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">How NFC Cleaning Verification Works</h2>
                    <p className="text-lg text-slate-600 text-center mb-14 max-w-2xl mx-auto">
                        Four steps. Thirty minutes to set up. Proof every night after that.
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {STEPS.map(step => {
                            const Icon = step.icon;
                            return (
                                <div key={step.num} className="text-center">
                                    <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Icon className="w-7 h-7" />
                                    </div>
                                    <div className="text-sm font-bold text-sky-600 mb-2">Step {step.num}</div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                                    <p className="text-slate-600 text-sm">{step.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══════ VERIFICATION SOLUTIONS ══════ */}
            <section className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">Choose Your Verification Path</h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl mx-auto">
                        Whether you want full-service management or just the verification layer — we have an option.
                    </p>
                    <div className="grid md:grid-cols-3 gap-6">
                        {VERIFICATION_SOLUTIONS.map(sol => {
                            const Icon = sol.icon;
                            return (
                                <Link
                                    key={sol.slug}
                                    href={`/solutions/${sol.slug}`}
                                    className="group block bg-white rounded-2xl p-8 border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all"
                                >
                                    <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-5">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors mb-3">
                                        {sol.title}
                                    </h3>
                                    <p className="text-slate-600 mb-4">{sol.description}</p>
                                    <span className="text-sky-600 font-semibold text-sm flex items-center gap-1">
                                        Learn more <ArrowRight className="w-4 h-4" />
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══════ WHO IT'S FOR ══════ */}
            <section className="py-20 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Built for Facility Managers Who Want Proof</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                title: 'Medical Practices',
                                description: 'JCAHO, CMS, and state inspectors ask for cleaning documentation. With NFC verification, you have 90+ days of timestamped records ready before they walk in.',
                                cta: 'Medical Facility Management',
                                href: '/solutions/medical-facility-management',
                            },
                            {
                                title: 'Commercial Tenants',
                                description: 'NNN lease tenants managing their own building need accountability from their cleaning vendor. Proof of work means no more wondering if the crew showed up.',
                                cta: 'Single-Tenant Maintenance',
                                href: '/solutions/single-tenant-maintenance',
                            },
                            {
                                title: 'Property Managers',
                                description: 'Managing multiple tenants across buildings? Share compliance log URLs with each tenant so they can verify cleaning independently.',
                                cta: 'Vendor Management Alternative',
                                href: '/solutions/vendor-management-alternative',
                            },
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-slate-600 mb-5">{item.description}</p>
                                <Link href={item.href} className="text-sky-600 font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                    {item.cta} <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════ RELATED CONTENT (Blog Posts) ══════ */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3 text-center">Learn More About Cleaning Verification</h2>
                    <p className="text-slate-500 text-center mb-10 max-w-2xl mx-auto">Deep dives into NFC technology, compliance, and why traditional verification fails.</p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {RELATED_POSTS.map(post => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}`}
                                className="group bg-white rounded-xl p-5 border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                            >
                                <h3 className="font-semibold text-slate-900 group-hover:text-sky-700 transition-colors text-sm leading-snug">
                                    {post.title}
                                </h3>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors flex-shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════ CALCULATOR CTA ══════ */}
            <section className="py-12 bg-sky-50 border-b border-sky-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        💰 What Should Your Facility Management Cost?
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                        Use our free janitorial cleaning cost calculator to see commercial cleaning rates for your facility type, size, and state.
                    </p>
                    <Link
                        href="/calculator"
                        className="inline-block bg-sky-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-200"
                    >
                        Try the Cost Calculator →
                    </Link>
                </div>
            </section>

            {/* ══════ FINAL CTA ══════ */}
            <section className="py-20 bg-slate-900 text-white text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-heading font-bold mb-4">
                        Stop wondering. Start verifying.
                    </h2>
                    <p className="text-sky-100 text-lg mb-8">
                        Whether you keep your current cleaner or switch to XIRI — you deserve to know what happens in your building every night.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/#audit"
                            className="inline-flex items-center justify-center bg-white text-sky-900 px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-sky-50 transition-all"
                        >
                            {CTA.primary}
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center border-2 border-sky-400 text-sky-100 px-8 py-4 rounded-full text-lg font-bold hover:bg-sky-800/50 transition-all"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
