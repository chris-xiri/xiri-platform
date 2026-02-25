import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import seoData from '@/data/seo-data.json';
import { CheckCircle, AlertTriangle, DollarSign, ArrowRight } from 'lucide-react';

// ── Guide Data ──
const GUIDES: Record<string, {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaDescription: string;
    sections: { title: string; content: string; items?: string[] }[];
    calloutTitle?: string;
    calloutContent?: string;
    relatedServices: string[];
    faqs: { question: string; answer: string }[];
}> = {
    'jcaho-cleaning-requirements': {
        title: 'JCAHO Cleaning Requirements for Medical Offices',
        heroTitle: 'JCAHO Cleaning Requirements: What Your Medical Office Needs to Know',
        heroSubtitle: 'A practical guide to meeting Joint Commission environmental cleaning standards — and maintaining compliance between surveys.',
        metaDescription: 'Complete guide to JCAHO cleaning requirements for medical offices. Learn terminal cleaning protocols, documentation standards, and how to stay survey-ready year-round.',
        sections: [
            {
                title: 'Why JCAHO Cleaning Standards Matter',
                content: 'The Joint Commission (formerly JCAHO) evaluates healthcare facilities on Environmental Care standards as part of their accreditation surveys. A failed environmental cleaning element can trigger a Requirement for Improvement (RFI) that jeopardizes your accreditation — and with it, your ability to bill Medicare and most insurance plans.',
            },
            {
                title: 'The Five Pillars of JCAHO-Compliant Cleaning',
                content: 'The Joint Commission evaluates environmental cleaning across these core areas:',
                items: [
                    'Terminal Cleaning Protocols — End-of-day deep disinfection of all patient care areas using EPA-registered, hospital-grade products following CDC Guidelines for Environmental Infection Control',
                    'Chemical Management — Proper storage, labeling, and Safety Data Sheet (SDS) documentation for all cleaning chemicals used in your facility',
                    'Staff Training — Documented training records showing cleaning staff are trained in bloodborne pathogen handling (OSHA 29 CFR 1910.1030), PPE usage, and proper disinfection techniques',
                    'Quality Monitoring — A systematic process for verifying that cleaning is done correctly — not just that it was done. This can include visual inspection, ATP testing, or fluorescent marker programs',
                    'Documentation & Records — Cleaning logs with dates, times, areas cleaned, chemicals used, and staff identification that can be produced during an unannounced survey',
                ],
            },
            {
                title: 'Common Survey Deficiencies in Environmental Cleaning',
                content: 'Based on Joint Commission survey data, the most frequently cited environmental cleaning deficiencies include:',
                items: [
                    'No documented cleaning schedule or scope of work',
                    'Cleaning products not on the EPA List N or appropriate for healthcare settings',
                    'No evidence of ongoing staff training or competency verification',
                    'Lack of a quality monitoring program for cleaning effectiveness',
                    'Expired SDS sheets or improperly labeled chemical containers',
                    'No evidence that high-touch surfaces are cleaned with appropriate frequency',
                ],
            },
            {
                title: 'How to Build a Survey-Ready Cleaning Program',
                content: 'A compliant program isn\'t built during survey prep — it\'s built into your daily operations. Here\'s the framework:',
                items: [
                    'Create a written Scope of Work that specifies cleaning tasks, frequencies, and responsible parties for every room and area',
                    'Use only EPA-registered hospital-grade disinfectants with documented dwell times',
                    'Implement a log system (digital preferred) that records every cleaning session with timestamps and staff identification',
                    'Schedule quarterly training refreshers for all cleaning staff on infection control and chemical safety',
                    'Implement a quality verification program — either internal spot-checks or an independent auditing system like XIRI\'s Night Manager program',
                ],
            },
        ],
        calloutTitle: 'How XIRI Keeps You Survey-Ready',
        calloutContent: 'Our Night Managers independently audit every clean in your facility with photographic documentation. Your FSM maintains digital cleaning logs, chemical SDS sheets, and training records — giving you instant access to 12 months of compliance documentation for any survey or inspection.',
        relatedServices: ['medical-office-cleaning', 'surgery-center-cleaning', 'disinfecting-services'],
        faqs: [
            {
                question: 'Does XIRI provide JCAHO-compliant cleaning documentation?',
                answer: 'Yes. We maintain timestamped digital logs of every cleaning session, chemical SDS sheets, contractor training records, and Night Manager audit photos. Your FSM can generate a compliance report on demand.',
            },
            {
                question: 'How often does the Joint Commission survey for cleaning?',
                answer: 'JCAHO conducts unannounced surveys every 2–3 years for accredited organizations. Environmental cleaning is evaluated during every survey under the Environment of Care (EC) standards.',
            },
            {
                question: 'Can your documentation replace our internal quality monitoring?',
                answer: 'Our Night Manager audit program satisfies the JCAHO requirement for a quality monitoring system for environmental cleaning. Each audit includes photographic evidence and a standardized checklist that documents cleaning effectiveness.',
            },
        ],
    },
    'commercial-cleaning-cost-guide': {
        title: 'How Much Does Commercial Cleaning Cost?',
        heroTitle: 'How Much Does Commercial Cleaning Cost in 2025?',
        heroSubtitle: 'A transparent breakdown of per-square-foot pricing, what drives costs up, and how to avoid overpaying.',
        metaDescription: 'Commercial cleaning costs $0.05–$0.25 per square foot depending on facility type, frequency, and scope. Get a transparent cost breakdown and learn how to budget for your facility.',
        sections: [
            {
                title: 'The Short Answer',
                content: 'Commercial cleaning typically costs between $0.05 and $0.25 per square foot per visit, depending on facility type, cleaning frequency, and scope of work. A standard 5,000 sq ft office cleaned 5 nights per week costs approximately $1,500–$3,000 per month. Medical offices and specialized facilities run 20–40% higher due to compliance requirements.',
            },
            {
                title: 'Cost by Facility Type',
                content: 'Different facility types carry different cleaning complexity — and cost:',
                items: [
                    'General Office — $0.05–$0.12/sq ft — Standard vacuuming, trash, restrooms, and surface dusting',
                    'Medical Office — $0.10–$0.20/sq ft — Terminal cleaning, biohazard protocols, compliance documentation',
                    'Surgery Center — $0.15–$0.25/sq ft — AORN-standard terminal cleaning, ATP testing, sterile area protocols',
                    'Daycare/Preschool — $0.08–$0.15/sq ft — Non-toxic products, toy sanitization, enhanced background checks',
                    'Auto Dealership — $0.06–$0.14/sq ft — Showroom glass, service bay degreasing, restroom high-traffic service',
                ],
            },
            {
                title: 'What Drives the Price Up',
                content: 'Several factors can push cleaning costs above the baseline range:',
                items: [
                    'Frequency — 5–7 nights/week costs more than 3 nights; daily day porter adds to the total',
                    'Compliance Requirements — Medical facilities need OSHA-compliant chemicals, documented training, and log maintenance',
                    'Scope Expansion — Adding floor care, window cleaning, or restroom supply stocking increases the per-visit cost',
                    'After-Hours Access — Facilities that require late-night or weekend cleaning may pay a small premium for scheduling flexibility',
                    'Square Footage — Larger facilities cost more in total but often achieve a lower per-sq-ft rate due to efficiency',
                ],
            },
            {
                title: 'How to Avoid Overpaying',
                content: 'The most common reason facilities overpay for cleaning is poor scope definition. Without a detailed written scope, you\'re paying for what the vendor thinks you need, not what you actually need. Here\'s how to get the right price:',
                items: [
                    'Get a walkthrough-based scope — Never accept a quote based solely on square footage. A qualified vendor should walk your facility room by room',
                    'Define frequencies by area — Not every room needs the same attention every night. High-traffic areas may need nightly service; storage rooms may need weekly',
                    'Consolidate vendors — Using one vendor (or one managed service like XIRI) for multiple services typically saves 15–25% vs. separate vendors for each service',
                    'Include quality verification — The cheapest bid with no quality control is the most expensive option long-term. Missed cleans and re-work cost more than doing it right',
                ],
            },
        ],
        calloutTitle: 'Get a Real Number for Your Facility',
        calloutContent: 'Per-square-foot ranges are useful for budgeting, but your actual cost depends on your specific facility. Our FSMs conduct a free on-site walkthrough and build a custom scope with transparent pricing — no surprises, no hidden fees.',
        relatedServices: ['commercial-cleaning', 'janitorial-services', 'medical-office-cleaning'],
        faqs: [
            {
                question: 'Does XIRI charge per square foot?',
                answer: 'We quote based on a custom scope, not just square footage. After your free site audit, you receive a flat monthly rate that reflects your actual cleaning needs, frequency, and facility complexity — with no hidden fees or per-incident charges.',
            },
            {
                question: 'Is XIRI more expensive than hiring a cleaning company directly?',
                answer: 'For basic office cleaning, we may be marginally higher than a bare-bones vendor — but we include Night Manager quality audits, FSM management, backup crew coverage, and consolidated invoicing. When you factor in the cost of managing a vendor yourself, most clients find XIRI is cost-neutral or saves money.',
            },
            {
                question: 'Do you offer different pricing tiers?',
                answer: 'We customize your scope and frequency rather than offering pre-set tiers. A 3-night basic clean costs less than a 5-night comprehensive scope. Your FSM recommends the right level based on your facility type and budget.',
            },
        ],
    },
    'inhouse-vs-outsourced-facility-management': {
        title: 'In-House vs Outsourced Facility Management',
        heroTitle: 'Should You Hire In-House or Outsource Facility Management?',
        heroSubtitle: 'A practical comparison for business owners who are tired of managing building maintenance themselves.',
        metaDescription: 'Compare in-house facility management vs outsourcing to a managed service. Cost analysis, pros and cons, and when each approach makes sense for your business.',
        sections: [
            {
                title: 'The Real Cost of In-House',
                content: 'Hiring an in-house facility manager sounds simple until you add up the total cost. For most single-tenant buildings under 25,000 sq ft, the math doesn\'t work:',
                items: [
                    'Salary — A full-time facility manager in the NYC metro area costs $55,000–$85,000/year',
                    'Benefits — Health insurance, PTO, and payroll taxes add 25–35% on top of salary',
                    'Coverage Gap — One person can\'t cover nights, weekends, and vacations. Who verifies the cleaning at midnight?',
                    'Vendor Management — They still need to source, vet, and manage every contractor. The work doesn\'t disappear',
                    'Total Effective Cost — $80,000–$115,000/year before you\'ve paid a single cleaning vendor',
                ],
            },
            {
                title: 'The Outsourced Alternative',
                content: 'Outsourcing facility management to a service like XIRI replaces the need for an in-house hire while adding capabilities a single employee can\'t provide:',
                items: [
                    'Dedicated FSM — Your Facility Solutions Manager functions as your building manager, conducting weekly site visits and managing all vendors',
                    'Night Coverage — Night Managers audit contractor work at midnight, 365 nights per year — something no single employee can do',
                    'Vendor Network — We\'ve already sourced, vetted, and insured contractors across every trade. No recruiting needed',
                    'Backup Coverage — If a vendor no-shows, we auto-dispatch a backup. No scrambling, no missed cleans',
                    'Total Cost — Typically 40–60% less than an in-house hire, and the service scales up or down with your needs',
                ],
            },
            {
                title: 'When In-House Makes Sense',
                content: 'In-house facility management can be the right choice in specific situations:',
                items: [
                    'Large campuses (50,000+ sq ft) with complex mechanical systems requiring daily on-site presence',
                    'Organizations with regulatory requirements for a named Facilities Director (some hospital systems)',
                    'Budgets that can support a full team — manager, assistant, and backup coverage',
                ],
            },
            {
                title: 'When Outsourcing Makes Sense',
                content: 'Outsourcing is the better fit for most single-tenant buildings:',
                items: [
                    'Buildings under 25,000 sq ft where a full-time hire is overkill',
                    'Medical offices, auto dealerships, daycares, and professional offices that need consistent quality but don\'t have facility management expertise',
                    'Business owners who want to focus on their core business and not on vendor coordination and maintenance logistics',
                    'Organizations that want verified quality (nightly audits) without the overhead of a management hire',
                ],
            },
        ],
        calloutTitle: 'See What Outsourcing Looks Like for Your Facility',
        calloutContent: 'We\'ll conduct a free site audit, identify every service your facility needs, and show you a transparent monthly cost that replaces the need for an in-house hire — with better coverage, verified quality, and one invoice.',
        relatedServices: ['janitorial-services', 'commercial-cleaning', 'floor-care', 'hvac-maintenance', 'pest-control', 'handyman-services'],
        faqs: [
            {
                question: 'Can XIRI fully replace an in-house facility manager?',
                answer: 'For most single-tenant buildings under 25,000 sq ft — yes. Your FSM handles weekly site visits, vendor coordination, quality control, and issue resolution. Night Managers cover overnight auditing. You get better coverage than a single employee at a lower total cost.',
            },
            {
                question: 'What if we have an in-house person and just want help with vendor management?',
                answer: 'We work alongside in-house teams too. Your facility manager can focus on capital projects, tenant relations, or other priorities while XIRI handles the vendor sourcing, scheduling, and nightly quality verification.',
            },
            {
                question: 'How do your costs compare to a full-time hire?',
                answer: 'A fully-loaded in-house facility manager costs $80,000–$115,000/year in the NYC metro area. XIRI\'s managed service typically runs 40–60% less — and includes Night Manager audits, backup coverage, and consolidated vendor management that a single employee can\'t provide.',
            },
        ],
    },
};

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    return Object.keys(GUIDES).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const guide = GUIDES[slug];
    if (!guide) return {};

    return {
        title: `${guide.title} | XIRI Facility Solutions`,
        description: guide.metaDescription,
        alternates: {
            canonical: `https://xiri.ai/guides/${slug}`,
        },
        openGraph: {
            title: guide.title,
            description: guide.metaDescription,
            url: `https://xiri.ai/guides/${slug}`,
            siteName: 'XIRI Facility Solutions',
            type: 'article',
        },
    };
}

export default async function GuidePage({ params }: Props) {
    const { slug } = await params;
    const guide = GUIDES[slug];

    if (!guide) {
        notFound();
    }

    const relatedServices = seoData.services.filter(s =>
        guide.relatedServices.includes(s.slug)
    );

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: guide.title,
                    description: guide.metaDescription,
                    url: `https://xiri.ai/guides/${slug}`,
                    publisher: {
                        '@type': 'Organization',
                        name: 'XIRI Facility Solutions',
                    },
                }}
            />

            {/* Hero */}
            <Hero
                title={guide.heroTitle}
                subtitle={guide.heroSubtitle}
                ctaText="Get a Free Site Audit"
            />

            {/* ═══ GUIDE CONTENT ═══ */}
            <article className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {guide.sections.map((section, i) => (
                        <div key={i} className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                            <p className="text-lg text-slate-600 mb-4 leading-relaxed">{section.content}</p>
                            {section.items && (
                                <ul className="space-y-3 mt-4">
                                    {section.items.map((item, j) => (
                                        <li key={j} className="flex gap-3 items-start">
                                            <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </article>

            {/* ═══ XIRI CALLOUT ═══ */}
            {guide.calloutTitle && (
                <section className="py-12 bg-sky-50 border-y border-sky-200">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex gap-5 items-start">
                            <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-full flex items-center justify-center text-sky-700">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sky-900 text-lg mb-2">{guide.calloutTitle}</h3>
                                <p className="text-sky-800">{guide.calloutContent}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ FAQs ═══ */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {guide.faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                <p className="text-slate-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ RELATED SERVICES ═══ */}
            {relatedServices.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                            Related Services
                        </h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relatedServices.map((s: any) => (
                                <Link key={s.slug} href={`/services/${s.slug}`} className="group block bg-slate-50 hover:bg-sky-50 rounded-xl p-5 border border-slate-200 hover:border-sky-300 transition-all">
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

            {/* ═══ FINAL CTA ═══ */}
            <section className="py-16 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Want Expert Help?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Book a free site audit. We&apos;ll assess your facility, build a custom cleaning scope, and provide transparent pricing — no obligation.
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
