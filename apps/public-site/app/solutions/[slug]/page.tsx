import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { DLPSidebar } from '@/components/DLPSidebar';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { CaseStudySpotlight } from '@/components/CaseStudySpotlight';
import { AskAnyAI } from '@/components/AskAnyAI';
import seoData from '@/data/seo-data.json';
import { CheckCircle, ArrowRight, Building2, Stethoscope, Shield, Users, FileText, Phone } from 'lucide-react';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { SOLUTIONS } from '@/data/solutions';
import { DLP_SOLUTIONS, SPOKE_HUBS } from '@/data/dlp-solutions';
import { SITE } from '@/lib/constants';

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    const locationSlugs = (seoData.locations || []).map((l: any) => l.slug);
    const dlpSlugs = Object.keys(DLP_SOLUTIONS);
    const crossProducts = dlpSlugs.flatMap(d => locationSlugs.map((l: string) => ({ slug: `${d}-in-${l}` })));
    return [
        ...Object.keys(SOLUTIONS).map(slug => ({ slug })),
        ...dlpSlugs.map(slug => ({ slug })),
        ...Object.keys(SPOKE_HUBS).map(slug => ({ slug })),
        ...crossProducts,
    ];
}

// Helper: parse cross-product slug like "jcaho-survey-ready-disinfection-in-great-neck-ny"
function parseCrossProductSlug(slug: string): { dlp: typeof DLP_SOLUTIONS[string]; dlpSlug: string; location: any } | null {
    const locations = seoData.locations || [];
    for (const loc of locations) {
        const suffix = `-in-${(loc as any).slug}`;
        if (slug.endsWith(suffix)) {
            const dlpSlug = slug.slice(0, slug.length - suffix.length);
            const dlp = DLP_SOLUTIONS[dlpSlug];
            if (dlp) return { dlp, dlpSlug, location: loc };
        }
    }
    return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const solution = SOLUTIONS[slug];
    const dlp = DLP_SOLUTIONS[slug];
    const hub = SPOKE_HUBS[slug];
    const page = solution || dlp || hub;

    // Cross-product: DLP × Location
    const cross = parseCrossProductSlug(slug);
    if (cross) {
        const townName = cross.location.name.split(',')[0].trim();
        const title = `${cross.dlp.title} in ${townName}, NY — $1M Insured & Verified | XIRI`;
        const localHook = (cross.location as any).localInsight
            ? `${(cross.location as any).localInsight.slice(0, 50)} `
            : '';
        const description = `${localHook}${cross.dlp.title} in ${townName}, ${cross.location.region || 'NY'}. Compliance-grade protocols, $1M insured, nightly NFC verified. Free walkthrough →`.slice(0, 155);
        return {
            title,
            description,
            alternates: { canonical: `${SITE.url}/solutions/${slug}` },
            openGraph: { title, description, url: `${SITE.url}/solutions/${slug}`, siteName: SITE.name, type: 'website' },
        };
    }

    if (!page) return {};

    return {
        title: `${page.title} — $1M Insured & Verified | XIRI Facility Solutions`,
        description: page.metaDescription,
        alternates: {
            canonical: `${SITE.url}/solutions/${slug}`,
        },
        openGraph: {
            title: `${page.title} | XIRI`,
            description: page.metaDescription,
            url: `${SITE.url}/solutions/${slug}`,
            siteName: SITE.name,
            type: 'website',
        },
    };
}

export default async function SolutionPage({ params }: Props) {
    const { slug } = await params;

    // ── Editorial Solutions (existing 3) ──
    const solution = SOLUTIONS[slug];
    if (solution) {
        const relevantServices = seoData.services.filter(s =>
            solution.relevantServices.includes(s.slug)
        );
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: solution.title, description: solution.metaDescription, url: `${SITE.url}/solutions/${slug}` }} />
                {slug === 'nfc-proof-of-work' && (
                    <JsonLd data={{
                        '@context': 'https://schema.org',
                        '@type': 'DefinedTerm',
                        name: 'Proof of Work (Commercial Cleaning)',
                        description: 'Verifiable, tamper-proof evidence that a cleaning crew was physically present in a facility and completed the contracted scope of work. In commercial cleaning, proof of work uses NFC (Near Field Communication) tags mounted in facility zones to create timestamped, zone-level records of cleaning activity.',
                        inDefinedTermSet: {
                            '@type': 'DefinedTermSet',
                            name: 'Facility Management Terms',
                        },
                        url: `${SITE.url}/solutions/nfc-proof-of-work`,
                    }} />
                )}
                <AuthorityBreadcrumb items={[{ label: 'Solutions', href: '/solutions' }, { label: solution.title }]} />
                <Hero title={solution.heroTitle} subtitle={solution.heroSubtitle} ctaText="Get a Free Site Audit" ctaLink="#audit" />
                <section className="py-16 bg-slate-50 border-y border-slate-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">{solution.problemTitle}</h2>
                        <div className="space-y-4">
                            {solution.problemPoints.map((point, i) => (
                                <div key={i} className="flex gap-4 items-start bg-white p-5 rounded-xl border border-slate-200">
                                    <div className="w-8 h-8 flex-shrink-0 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</div>
                                    <p className="text-slate-700 text-lg">{point}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                {solution.comparisonTable && (
                    <section className="py-16 bg-white">
                        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">DIY vs. Software vs. XIRI</h2>
                            <p className="text-slate-500 text-center mb-10 max-w-2xl mx-auto">See why more facility managers are ditching spreadsheets and software for a managed solution.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead><tr className="border-b-2 border-slate-200"><th className="text-left py-4 px-4 text-slate-500 font-medium"></th><th className="text-center py-4 px-4 text-slate-500 font-medium">DIY / Spreadsheets</th><th className="text-center py-4 px-4 text-slate-500 font-medium">FM Software</th><th className="text-center py-4 px-4 text-sky-700 font-bold bg-sky-50 rounded-t-xl">XIRI</th></tr></thead>
                                    <tbody>{solution.comparisonTable.map((row, i) => (<tr key={i} className="border-b border-slate-100"><td className="py-4 px-4 font-semibold text-slate-900">{row.category}</td><td className="py-4 px-4 text-center text-slate-500">{row.diy}</td><td className="py-4 px-4 text-center text-slate-500">{row.software}</td><td className="py-4 px-4 text-center text-sky-700 font-semibold bg-sky-50">{row.xiri}</td></tr>))}</tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}
                <section className="py-16 bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">{solution.solutionTitle}</h2>
                        <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">We don&apos;t just clean — we manage your entire facility so you don&apos;t have to.</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            {solution.solutionPoints.map((point, i) => (
                                <div key={i} className="bg-slate-50 rounded-xl p-8 border border-slate-200 hover:border-sky-300 transition-colors">
                                    <div className="flex items-center gap-3 mb-4"><CheckCircle className="w-6 h-6 text-sky-600 flex-shrink-0" /><h3 className="text-xl font-bold text-slate-900">{point.title}</h3></div>
                                    <p className="text-slate-600">{point.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                {relevantServices.length > 0 && (
                    <section className="py-16 bg-slate-50 border-y border-slate-200">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-3 text-center">Services Included</h2>
                            <p className="text-slate-500 text-center mb-10 max-w-2xl mx-auto">All managed under one agreement, one FSM, and one monthly invoice.</p>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relevantServices.map((s: any) => (
                                    <Link key={s.slug} href={`/services/${s.slug}`} className="group block bg-white rounded-xl p-5 border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
                                        <div className="flex items-center justify-between">
                                            <div><h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors">{s.name}</h3><p className="text-sm text-slate-500 mt-1">{s.shortDescription?.slice(0, 80)}…</p></div>
                                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 transition-colors flex-shrink-0" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
                <CaseStudySpotlight variant="compact" />
                <FAQ items={solution.faqs} />
                <section id="audit" className="py-20 bg-sky-900 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">Ready to Simplify Your Facility?</h2>
                            <p className="text-xl text-sky-100 mb-6">Book a free site audit. We&apos;ll walk your facility, build a custom scope, and show you exactly what XIRI looks like for your building.</p>
                            <a href={`tel:${SITE.phone}`} className="inline-flex items-center gap-2 text-sky-200 hover:text-white font-semibold">
                                <Phone className="w-5 h-5" /> Or call our Technical Project Desk: {SITE.phoneDisplay}
                            </a>
                        </div>
                        <div>
                            <ClientLeadForm industryName={solution.title} prefilledService={solution.relevantServices[0]} />
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    // ── Spoke Hub Pages ──
    const hub = SPOKE_HUBS[slug];
    if (hub) {
        const hubDlps = hub.dlpSlugs.map(s => ({ slug: s, ...DLP_SOLUTIONS[s] })).filter(Boolean);
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: hub.title, description: hub.metaDescription, url: `${SITE.url}/solutions/${slug}` }} />
                <AuthorityBreadcrumb items={[{ label: 'Solutions', href: '/solutions' }, { label: hub.title }]} />
                <Hero title={hub.heroTitle} subtitle={hub.heroSubtitle} ctaText="Get a Free Site Audit" ctaLink="#audit" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-slate-900 mb-8">Specialized Solutions</h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {hubDlps.map((dlp) => (
                                        <Link key={dlp.slug} href={`/solutions/${dlp.slug}`} className="group block bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all">
                                            <h3 className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors mb-2">{dlp.title}</h3>
                                            <p className="text-sm text-slate-500">{dlp.heroSubtitle.slice(0, 120)}…</p>
                                            <div className="mt-3 text-sky-600 text-sm font-medium flex items-center gap-1">Learn more <ArrowRight className="w-3 h-3" /></div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category={hub.sidebarCategory} currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <CaseStudySpotlight variant="compact" />
                <section id="audit" className="py-20 bg-sky-900 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">Need a Specialized Solution?</h2>
                            <p className="text-xl text-sky-100 mb-6">Book a free site audit. We&apos;ll assess your facility&apos;s specific compliance requirements and build a protocol that fits.</p>
                        </div>
                        <div>
                            <ClientLeadForm industryName={hub.title} />
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    // ── DLP Pages (Dental, ESD Floor Care, IoT Hardware, etc.) ──
    const dlp = DLP_SOLUTIONS[slug];
    if (dlp) {
        const relevantServices = seoData.services.filter(s => dlp.relevantServices.includes(s.slug));
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Service', name: dlp.title, description: dlp.metaDescription, url: `${SITE.url}/solutions/${slug}`, provider: { '@type': 'Organization', '@id': `${SITE.url}/#organization` } }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: dlp.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
                <AuthorityBreadcrumb items={[{ label: 'Solutions', href: '/solutions' }, { label: dlp.title }]} />
                <Hero title={dlp.heroTitle} subtitle={dlp.heroSubtitle} ctaText={`Scope My ${dlp.title}`} ctaLink="#audit" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                {/* Direct Project / Technical Desk Callout */}
                                <div className="mb-10 bg-sky-50 border border-sky-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-1">
                                            Technical &amp; Compliance Project Desk · Nassau, Suffolk &amp; Queens
                                        </p>
                                        <p className="text-sm sm:text-base text-slate-800 font-medium">
                                            Need an immediate quote or site walkthrough for <strong>{dlp.title}</strong>?
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                                        <a href={`tel:${SITE.phone}`} className="inline-flex items-center gap-2 bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
                                            <Phone className="w-4 h-4 text-sky-600" />
                                            {SITE.phoneDisplay}
                                        </a>
                                        <a href="#audit" className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
                                            Request Scope <ArrowRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>

                                {/* Content Sections */}
                                {dlp.sections.map((section, i) => (
                                    <div key={i} className="mb-10">
                                        <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                                        <p className="text-slate-600 text-lg leading-relaxed">{section.content}</p>
                                    </div>
                                ))}

                                {/* Compliance Checklist (Layer 2) */}
                                <div className="bg-slate-50 rounded-xl p-8 border border-slate-200 mb-10">
                                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-sky-600" /> Technical &amp; Compliance Checklist
                                    </h3>
                                    <div className="space-y-4">
                                        {dlp.complianceChecklist.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-slate-800 font-medium">{item.item}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{item.standard}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Services */}
                                {relevantServices.length > 0 && (
                                    <div className="mb-10">
                                        <h3 className="text-xl font-bold text-slate-900 mb-4">Related Services</h3>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            {relevantServices.map((s: any) => (
                                                <Link key={s.slug} href={`/services/${s.slug}`} className="group flex items-center justify-between bg-white rounded-lg p-4 border border-slate-200 hover:border-sky-300 transition-colors">
                                                    <span className="font-medium text-slate-800 group-hover:text-sky-700">{s.name}</span>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <AskAnyAI variant="card" heading={`Ask AI About XIRI's ${dlp.title} Protocol`} />
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category={dlp.sidebarCategory} currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <CaseStudySpotlight variant="compact" />
                <FAQ items={dlp.faqs} />
                {/* ═══ INLINE LEAD FORM ═══ */}
                <section id="audit" className="py-20 bg-sky-900 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">Get a Quote for {dlp.title}</h2>
                            <p className="text-xl text-sky-100 mb-6">Enter your email and facility zip code in Nassau County, Suffolk County, or Queens. Our technical operations team will schedule a walkthrough and build your custom protocol within 48 hours.</p>
                            <a href={`tel:${SITE.phone}`} className="inline-flex items-center gap-2 text-sky-200 hover:text-white font-semibold">
                                <Phone className="w-5 h-5" /> Direct Project Desk: {SITE.phoneDisplay}
                            </a>
                        </div>
                        <div>
                            <ClientLeadForm industryName={dlp.title} prefilledService={dlp.relevantServices[0]} />
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    // ── Cross-Product: DLP × Location ──
    const cross = parseCrossProductSlug(slug);
    if (cross) {
        const { dlp, dlpSlug, location } = cross;
        const townName = location.name.split(',')[0].trim();
        const relevantServices = seoData.services.filter(s => dlp.relevantServices.includes(s.slug));
        return (
            <div className="min-h-screen bg-white">
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${dlp.title} in ${location.name}`, description: dlp.metaDescription, url: `${SITE.url}/solutions/${slug}` }} />
                <JsonLd data={{
                    '@context': 'https://schema.org',
                    '@type': 'LocalBusiness',
                    '@id': `${SITE.url}/solutions/${slug}#business`,
                    name: `XIRI ${dlp.title} — ${location.name}`,
                    description: dlp.metaDescription,
                    image: 'https://xiri.ai/xiri-logo-horizontal.svg',
                    url: `${SITE.url}/solutions/${slug}`,
                    telephone: '+1-516-399-0350',
                    priceRange: '$$',
                    address: { '@type': 'PostalAddress', addressLocality: townName, addressRegion: location.state, addressCountry: 'US' },
                    ...(location.latitude ? { geo: { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude } } : {}),
                    openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' },
                }} />
                <JsonLd data={{
                    '@context': 'https://schema.org',
                    '@type': 'Service',
                    name: `${dlp.title} in ${location.name}`,
                    description: dlp.metaDescription,
                    provider: { '@type': 'LocalBusiness', '@id': `${SITE.url}/solutions/${slug}#business` },
                    areaServed: { '@type': 'Place', name: `${townName}, ${location.state}` },
                    serviceType: dlp.title,
                }} />
                <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: dlp.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
                <AuthorityBreadcrumb items={[
                    { label: 'Solutions', href: '/solutions' },
                    { label: dlp.title, href: `/solutions/${dlpSlug}` },
                    { label: townName },
                ]} />
                <Hero title={`${dlp.heroTitle} in ${townName}`} subtitle={dlp.heroSubtitle} ctaText={`Get a ${townName} Quote`} ctaLink="#audit" />
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col lg:flex-row gap-12">
                            <div className="flex-1">
                                {/* Local Context */}
                                <div className="mb-10 bg-sky-50 rounded-xl p-6 border border-sky-100">
                                    <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-sky-600" /> Serving {townName} ({location.zipCodes?.join(', ') || location.region})
                                    </h2>
                                    <p className="text-slate-600">
                                        XIRI provides {dlp.title.toLowerCase()} services for facilities in {location.name} and the surrounding {location.region || ''} area.
                                        {location.localInsight ? ` ${location.localInsight}` : ''}
                                    </p>
                                </div>
                                {/* Content Sections */}
                                {dlp.sections.map((section, i) => (
                                    <div key={i} className="mb-10">
                                        <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                                        <p className="text-slate-600 text-lg leading-relaxed">{section.content}</p>
                                    </div>
                                ))}
                                {/* Compliance Checklist */}
                                <div className="bg-slate-50 rounded-xl p-8 border border-slate-200 mb-10">
                                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-sky-600" /> Technical &amp; Compliance Checklist
                                    </h3>
                                    <div className="space-y-4">
                                        {dlp.complianceChecklist.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-slate-800 font-medium">{item.item}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{item.standard}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Related Services */}
                                {relevantServices.length > 0 && (
                                    <div className="mb-10">
                                        <h3 className="text-xl font-bold text-slate-900 mb-4">Related Services in {townName}</h3>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            {relevantServices.map((s: any) => (
                                                <Link key={s.slug} href={`/services/${s.slug}`} className="group flex items-center justify-between bg-white rounded-lg p-4 border border-slate-200 hover:border-sky-300 transition-colors">
                                                    <span className="font-medium text-slate-800 group-hover:text-sky-700">{s.name}</span>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Back to DLP */}
                                <div className="mb-6">
                                    <Link href={`/solutions/${dlpSlug}`} className="text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                                        ← {dlp.title} (All Locations)
                                    </Link>
                                </div>
                            </div>
                            <div className="lg:w-72 flex-shrink-0">
                                <DLPSidebar category={dlp.sidebarCategory} currentSlug={slug} />
                            </div>
                        </div>
                    </div>
                </section>
                <CaseStudySpotlight variant="compact" />
                <FAQ items={dlp.faqs} />
                <section id="audit" className="py-20 bg-sky-900 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">Need {dlp.title} in {townName}?</h2>
                            <p className="text-xl text-sky-100 mb-6">Book a free site audit in {townName}. We&apos;ll assess your facility and build a compliance-ready protocol.</p>
                            <a href={`tel:${SITE.phone}`} className="inline-flex items-center gap-2 text-sky-200 hover:text-white font-semibold">
                                <Phone className="w-5 h-5" /> Direct Project Desk: {SITE.phoneDisplay}
                            </a>
                        </div>
                        <div>
                            <ClientLeadForm industryName={`${dlp.title} - ${townName}`} prefilledService={dlp.relevantServices[0]} />
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    notFound();
}
