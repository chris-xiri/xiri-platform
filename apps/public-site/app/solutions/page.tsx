import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { SITE, CTA } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Solutions | XIRI Facility Solutions',
    description: 'XIRI facility management solutions: medical facility management, single-tenant maintenance, and vendor management alternative. One partner, one invoice.',
    alternates: {
        canonical: 'https://xiri.ai/solutions',
    },
};

const SOLUTIONS = [
    {
        slug: 'cleaning-verification',
        title: 'Cleaning Verification',
        subtitle: 'Know exactly what happened. Every night.',
        description: 'NFC proof of work, digital compliance logs, and the option to keep your existing cleaner while adding accountability. The verification system no other cleaning company offers.',
        features: ['NFC Proof of Work', 'Digital Compliance Logs', 'Keep Your Cleaner Option'],
        featured: true,
    },
    {
        slug: 'medical-facility-management',
        title: 'Medical Facility Management',
        subtitle: 'OSHA + HIPAA compliant facility management built for medical practices.',
        description: 'We handle the cleaning, supplies, and compliance paperwork so you can focus on patients. Every shift follows CDC guidelines and bloodborne pathogen standards.',
        features: ['OSHA + HIPAA Compliant', 'Nightly Verification', 'Compliance Documentation'],
    },
    {
        slug: 'single-tenant-maintenance',
        title: 'Single-Tenant Building Maintenance',
        subtitle: 'Stop juggling 5 vendors for 1 building.',
        description: 'Consolidate janitorial, floor care, HVAC, pest control, and exterior maintenance under one partner with one invoice. We manage the vendors so you manage your building.',
        features: ['Roof-to-Floor Coverage', 'One Monthly Invoice', 'Dedicated FSM'],
    },
    {
        slug: 'vendor-management-alternative',
        title: 'Vendor Management Alternative',
        subtitle: 'We replace the software AND the work.',
        description: 'Most vendor management platforms make you manage the platform. XIRI does the actual work — vetting contractors, verifying shifts, handling escalations, and sending one bill.',
        features: ['No Software to Learn', 'We Handle Escalations', 'Real-Time Quality Audits'],
    },
    {
        slug: 'keep-your-cleaner',
        title: 'Keep Your Cleaner, Add Accountability',
        subtitle: 'No vendor change required.',
        description: 'Love your cleaning crew but can\'t verify their work? We install NFC tags, train your existing crew in 10 minutes, and you get a compliance log every morning.',
        features: ['Keep Your Existing Vendor', 'Per-Zone Pricing', '30-Minute Setup'],
    },
    {
        slug: 'nfc-proof-of-work',
        title: 'NFC Proof of Work',
        subtitle: 'Tamper-proof cleaning verification.',
        description: 'NFC tags in every zone. Cleaners scan in, complete tasks, and leave a timestamped record. No paper logs, no GPS spoofing, no guessing if the crew showed up.',
        features: ['Zone-by-Zone Verification', 'Timestamped Records', 'Photo Documentation'],
    },
    {
        slug: 'digital-compliance-log',
        title: 'Digital Compliance Logs',
        subtitle: 'Always inspector-ready.',
        description: 'Automatic, NFC-verified cleaning logs your inspectors can access via URL — no binders, no spreadsheets, no chasing your vendor for documentation.',
        features: ['Auto-Generated Records', 'Public Compliance URL', 'Completion Rate Tracking'],
    },
];

export default function SolutionsIndex() {
    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://xiri.ai/solutions" },
                    ]
                }}
            />

            {/* Hero */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-sky-50 to-white border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-3">Solutions</p>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
                        Facility management that actually delivers
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        Choose the solution that fits how your building operates.
                    </p>
                </div>
            </section>

            {/* Solution Cards */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    {SOLUTIONS.map(sol => (
                        <Link
                            key={sol.slug}
                            href={`/solutions/${sol.slug}`}
                            className="group block p-8 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-lg transition-all"
                        >
                            <p className="text-sm font-bold text-sky-600 tracking-wider uppercase mb-2">{sol.subtitle}</p>
                            <h2 className="text-2xl font-heading font-bold text-slate-900 group-hover:text-sky-600 transition-colors mb-3">
                                {sol.title}
                            </h2>
                            <p className="text-slate-600 mb-4 max-w-2xl">{sol.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {sol.features.map(f => (
                                    <span key={f} className="text-xs font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 bg-sky-900 text-white text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-heading font-bold mb-4">Not sure which solution fits?</h2>
                    <p className="text-sky-100 text-lg mb-8">
                        Tell us about your building and we&apos;ll recommend the right approach.
                    </p>
                    <Link
                        href="/#audit"
                        className="inline-flex items-center bg-white text-sky-900 px-8 py-4 rounded-full text-lg font-medium shadow-lg hover:bg-sky-50 transition-all"
                    >
                        {CTA.primary}
                    </Link>
                </div>
            </section>
        </div>
    );
}
