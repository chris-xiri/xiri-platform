import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import seoData from '@/data/seo-data.json';
import { CheckCircle, ArrowRight, Building2, Stethoscope, Shield, Users, FileText, Phone } from 'lucide-react';

// ── Solutions Data ──
const SOLUTIONS: Record<string, {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    problemTitle: string;
    problemPoints: string[];
    solutionTitle: string;
    solutionPoints: { title: string; description: string }[];
    relevantServices: string[];
    faqs: { question: string; answer: string }[];
    comparisonTable?: { category: string; diy: string; software: string; xiri: string }[];
}> = {
    'medical-facility-management': {
        title: 'Medical Facility Management',
        heroTitle: 'Facility Management Built for Medical Practices',
        heroSubtitle: 'JCAHO-compliant cleaning, documented audits, and one invoice — so you can focus on patient care, not janitorial logistics.',
        metaDescription: 'Professional facility management for medical offices, urgent care centers, and surgery centers. JCAHO-compliant cleaning with nightly audits and one consolidated invoice.',
        problemTitle: 'The Hidden Cost of "Managing It Yourself"',
        problemPoints: [
            'Your office manager spends 5+ hours/week coordinating vendors, chasing invoices, and handling complaints',
            'Missed cleans go unnoticed until a patient or surveyor notices — putting your accreditation at risk',
            'Generic cleaning companies don\'t understand bloodborne pathogen protocols or terminal cleaning standards',
            'Multiple vendors mean multiple invoices, multiple insurance certificates to track, and multiple points of failure',
            'When a vendor no-shows, you\'re scrambling to find a replacement while patients walk into a dirty facility',
        ],
        solutionTitle: 'How XIRI Solves It',
        solutionPoints: [
            {
                title: 'One Point of Contact',
                description: 'Your dedicated Facility Solutions Manager handles everything — vendor coordination, scheduling, complaints, and compliance documentation. You make one call, ever.',
            },
            {
                title: 'Nightly Audits, Not Promises',
                description: 'Our Night Managers physically verify every clean in your facility. You get photographic proof every morning — not just a contractor\'s word.',
            },
            {
                title: 'JCAHO & OSHA Compliance Built In',
                description: 'We maintain digital cleaning logs, chemical SDS sheets, and audit documentation that\'s ready for your next accreditation survey or state inspection.',
            },
            {
                title: 'One Invoice, Every Service',
                description: 'Janitorial, floor care, pest control, waste management, HVAC filters — all consolidated into one monthly invoice with transparent line items.',
            },
        ],
        relevantServices: ['medical-office-cleaning', 'urgent-care-cleaning', 'surgery-center-cleaning', 'disinfecting-services', 'floor-care', 'waste-management'],
        faqs: [
            {
                question: 'How is XIRI different from hiring a cleaning company directly?',
                answer: 'A cleaning company sends a crew. XIRI sends a crew, a Night Manager who audits their work, and a dedicated FSM who manages everything. We verify quality independently — the auditor is never the cleaner.',
            },
            {
                question: 'Can you handle a multi-location medical practice?',
                answer: 'Yes. We manage multi-site medical groups with coordinated cleaning schedules, standardized quality metrics, and one consolidated invoice across all locations.',
            },
            {
                question: 'What happens if we have a compliance survey tomorrow?',
                answer: 'Because our Night Managers audit nightly with photographic documentation, your facility is always survey-ready. We can pull 12 months of cleaning logs, chemical records, and audit photos within minutes.',
            },
            {
                question: 'How quickly can you start service?',
                answer: 'From initial site audit to first clean is typically 5–7 business days. Emergency start for facilities with urgent needs can be coordinated in as little as 48 hours.',
            },
        ],
    },
    'single-tenant-maintenance': {
        title: 'Single-Tenant Building Maintenance',
        heroTitle: 'Stop Juggling Vendors for Your Building',
        heroSubtitle: 'If you\'re a single-tenant occupier responsible for your own building maintenance, you need a system — not another spreadsheet.',
        metaDescription: 'Complete building maintenance for single-tenant NNN lease occupiers. One vendor, one invoice, and one point of contact for janitorial, HVAC, snow removal, and everything between the roof and floor.',
        problemTitle: 'The NNN Tenant\'s Nightmare',
        problemPoints: [
            'Triple-net lease means you\'re responsible for everything — but you\'re not a property manager, you\'re a business owner',
            'You have 4–7 different vendors for cleaning, snow, HVAC, pest control, and handyman — and none of them talk to each other',
            'Tracking insurance certificates, scheduling, and invoices for each vendor consumes your admin staff\'s time',
            'When a vendor doesn\'t show up, nobody notices until Monday morning — and now it\'s your problem',
            'You\'re paying retail for each service because no single vendor manages enough of your building to give you leverage',
        ],
        solutionTitle: 'One Call Covers Your Entire Building',
        solutionPoints: [
            {
                title: 'Roof to Floor Coverage',
                description: 'Janitorial, floor care, windows, HVAC filters, pest control, snow removal, parking lot maintenance, handyman — all managed under one agreement.',
            },
            {
                title: 'Your FSM Is Your Building Manager',
                description: 'Your dedicated Facility Solutions Manager handles all vendor coordination, scheduling, quality control, and issue resolution. Weekly site visits ensure nothing slips.',
            },
            {
                title: 'One Invoice, Zero Surprises',
                description: 'Every service consolidated into one predictable monthly invoice. No more tracking 7 vendors, 7 insurance certs, and 7 payment schedules.',
            },
            {
                title: 'Verified Quality, Every Night',
                description: 'Night Managers physically audit contractor work and submit photographic documentation. You see proof of quality — not just promises.',
            },
        ],
        relevantServices: ['janitorial-services', 'floor-care', 'window-cleaning', 'hvac-maintenance', 'pest-control', 'snow-ice-removal', 'parking-lot-maintenance', 'handyman-services'],
        faqs: [
            {
                question: 'What is a triple-net (NNN) lease and why does it matter for maintenance?',
                answer: 'In a NNN lease, the tenant is responsible for all building operating expenses including maintenance, insurance, and taxes — not the landlord. That means you need to source and manage every vendor yourself, or partner with XIRI to handle it all.',
            },
            {
                question: 'We\'re a small business — can we afford this?',
                answer: 'Most clients find that consolidating vendors through XIRI actually reduces total cost. You eliminate redundant service visits, get volume pricing across services, and reclaim the admin hours your staff spends chasing vendors.',
            },
            {
                question: 'How does pricing work?',
                answer: 'We build a custom scope based on your facility size, service needs, and frequency. You get one flat monthly rate that covers all included services — no hourly billing, no surprise charges, no per-incident fees.',
            },
            {
                question: 'Can we start with just cleaning and add services later?',
                answer: 'Absolutely. Most clients start with janitorial as the foundation and add floor care, pest control, HVAC, and seasonal services over time. Your FSM recommends additions based on what they observe during weekly site visits.',
            },
        ],
    },
    'vendor-management-alternative': {
        title: 'The Vendor Management Alternative',
        heroTitle: 'Stop Managing Vendors. Start Managing Results.',
        heroSubtitle: 'You don\'t need vendor management software. You need someone to manage the vendors for you.',
        metaDescription: 'Tired of spreadsheets and software to manage cleaning and maintenance vendors? XIRI replaces vendor management tools with actual vendor management — one contact, one invoice, verified quality.',
        problemTitle: 'Software Can\'t Fix a People Problem',
        problemPoints: [
            'You tried spreadsheets — tracking 5+ vendors, their schedules, insurance expiration dates, and invoices across tabs that nobody updates',
            'You looked at CMMS or FM software — $200–500/month tools that still require you to find, vet, and manage every vendor yourself',
            'The software shows you what\'s broken. It doesn\'t fix it. You still make the calls, chase the quotes, and follow up on no-shows',
            'Your admin staff spends 8–10 hours/week on vendor coordination that isn\'t their actual job',
            'When quality drops, software can\'t walk your building at midnight to verify the cleaning was actually done',
        ],
        solutionTitle: 'We Replace the Software AND the Work',
        solutionPoints: [
            {
                title: 'We Find & Vet the Vendors',
                description: 'You don\'t source contractors. We recruit, background-check, verify insurance, and match the right vendor to your facility. You approve — we do the legwork.',
            },
            {
                title: 'We Manage the Schedule',
                description: 'No more tracking who comes on which night. Your FSM builds the schedule, coordinates all vendors, and handles any no-shows or substitutions automatically.',
            },
            {
                title: 'We Verify the Quality',
                description: 'Software can\'t walk your building at midnight. Our Night Managers physically audit every clean and submit photographic proof before morning.',
            },
            {
                title: 'We Send One Invoice',
                description: 'Stop reconciling 5 vendor invoices every month. One XIRI invoice covers everything — janitorial, floor care, pest, snow, HVAC, and more.',
            },
        ],
        relevantServices: ['janitorial-services', 'commercial-cleaning', 'floor-care', 'window-cleaning', 'pest-control', 'hvac-maintenance'],
        comparisonTable: [
            { category: 'Monthly Cost', diy: 'Your staff\'s time', software: '$200–$500/mo + vendor costs', xiri: 'One flat monthly invoice' },
            { category: 'Vendor Sourcing', diy: 'You do it', software: 'You do it', xiri: 'We do it' },
            { category: 'Insurance Tracking', diy: 'You track it', software: 'You upload it', xiri: 'We verify it' },
            { category: 'Quality Verification', diy: 'Hope for the best', software: 'Self-reported checklists', xiri: 'Night Manager audits nightly' },
            { category: 'No-Show Coverage', diy: 'You scramble', software: 'Alerts you', xiri: 'Auto-dispatches backup' },
            { category: 'Single Invoice', diy: '5–7 separate bills', software: 'Still 5–7 bills', xiri: 'One invoice, all services' },
        ],
        faqs: [
            {
                question: 'How is XIRI different from facility management software?',
                answer: 'Software gives you tools to manage vendors yourself. XIRI actually manages the vendors for you. We source them, schedule them, audit their work nightly, and consolidate everything into one invoice. You get the result without the work.',
            },
            {
                question: 'What if I already have vendors I want to keep?',
                answer: 'We can work with your existing vendors or replace them — your choice. If you want to keep a vendor you trust, we simply add them to our management and auditing system.',
            },
            {
                question: 'Is this more expensive than managing it ourselves?',
                answer: 'When you factor in the admin hours your staff spends on vendor coordination (8–10 hrs/week at $25–40/hr), plus the cost of missed quality issues and emergency replacements, most clients find XIRI is cost-neutral or saves money.',
            },
            {
                question: 'How quickly can we transition from our current setup?',
                answer: 'Typical transition takes 2–3 weeks. Your FSM conducts a site audit, builds the scope, identifies needed vendors, and coordinates the switchover with minimal disruption to your operations.',
            },
        ],
    },
};

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    return Object.keys(SOLUTIONS).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const solution = SOLUTIONS[slug];
    if (!solution) return {};

    return {
        title: `${solution.title} | XIRI Facility Solutions`,
        description: solution.metaDescription,
        alternates: {
            canonical: `https://xiri.ai/solutions/${slug}`,
        },
        openGraph: {
            title: `${solution.title} | XIRI`,
            description: solution.metaDescription,
            url: `https://xiri.ai/solutions/${slug}`,
            siteName: 'XIRI Facility Solutions',
            type: 'website',
        },
    };
}

export default async function SolutionPage({ params }: Props) {
    const { slug } = await params;
    const solution = SOLUTIONS[slug];

    if (!solution) {
        notFound();
    }

    const relevantServices = seoData.services.filter(s =>
        solution.relevantServices.includes(s.slug)
    );

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebPage',
                    name: solution.title,
                    description: solution.metaDescription,
                    url: `https://xiri.ai/solutions/${slug}`,
                }}
            />

            {/* Hero */}
            <Hero
                title={solution.heroTitle}
                subtitle={solution.heroSubtitle}
                ctaText="Get a Free Site Audit"
            />

            {/* ═══ THE PROBLEM ═══ */}
            <section className="py-16 bg-slate-50 border-y border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
                        {solution.problemTitle}
                    </h2>
                    <div className="space-y-4">
                        {solution.problemPoints.map((point, i) => (
                            <div key={i} className="flex gap-4 items-start bg-white p-5 rounded-xl border border-slate-200">
                                <div className="w-8 h-8 flex-shrink-0 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-sm">
                                    {i + 1}
                                </div>
                                <p className="text-slate-700 text-lg">{point}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ COMPARISON TABLE (vendor-management only) ═══ */}
            {solution.comparisonTable && (
                <section className="py-16 bg-white">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                            DIY vs. Software vs. XIRI
                        </h2>
                        <p className="text-slate-500 text-center mb-10 max-w-2xl mx-auto">
                            See why more facility managers are ditching spreadsheets and software for a managed solution.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="text-left py-4 px-4 text-slate-500 font-medium"></th>
                                        <th className="text-center py-4 px-4 text-slate-500 font-medium">DIY / Spreadsheets</th>
                                        <th className="text-center py-4 px-4 text-slate-500 font-medium">FM Software</th>
                                        <th className="text-center py-4 px-4 text-sky-700 font-bold bg-sky-50 rounded-t-xl">XIRI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {solution.comparisonTable.map((row, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                            <td className="py-4 px-4 font-semibold text-slate-900">{row.category}</td>
                                            <td className="py-4 px-4 text-center text-slate-500">{row.diy}</td>
                                            <td className="py-4 px-4 text-center text-slate-500">{row.software}</td>
                                            <td className="py-4 px-4 text-center text-sky-700 font-semibold bg-sky-50">{row.xiri}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ THE SOLUTION ═══ */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                        {solution.solutionTitle}
                    </h2>
                    <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">
                        We don&apos;t just clean — we manage your entire facility so you don&apos;t have to.
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                        {solution.solutionPoints.map((point, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-8 border border-slate-200 hover:border-sky-300 transition-colors">
                                <div className="flex items-center gap-3 mb-4">
                                    <CheckCircle className="w-6 h-6 text-sky-600 flex-shrink-0" />
                                    <h3 className="text-xl font-bold text-slate-900">{point.title}</h3>
                                </div>
                                <p className="text-slate-600">{point.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ RELEVANT SERVICES ═══ */}
            {relevantServices.length > 0 && (
                <section className="py-16 bg-slate-50 border-y border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-3 text-center">
                            Services Included
                        </h2>
                        <p className="text-slate-500 text-center mb-10 max-w-2xl mx-auto">
                            All managed under one agreement, one FSM, and one monthly invoice.
                        </p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relevantServices.map((s: any) => (
                                <Link key={s.slug} href={`/services/${s.slug}`} className="group block bg-white rounded-xl p-5 border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{s.name}</h3>
                                            <p className="text-sm text-slate-500 mt-1">{s.shortDescription?.slice(0, 80)}…</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors flex-shrink-0" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ FAQs ═══ */}
            <FAQ items={solution.faqs} />

            {/* ═══ FINAL CTA ═══ */}
            <section className="py-16 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Ready to Simplify Your Facility?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Book a free site audit. We&apos;ll walk your facility, build a custom scope, and show you exactly what XIRI looks like for your building.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Site Audit"
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors"
                    />
                </div>
            </section>
        </div>
    );
}
