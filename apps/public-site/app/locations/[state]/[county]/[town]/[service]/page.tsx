import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { NearbyAreas } from '@/components/NearbyAreas';
import { CaseStudySpotlight } from '@/components/CaseStudySpotlight';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { AskAnyAI } from '@/components/AskAnyAI';
import { SITE } from '@/lib/constants';
import { getLocationBySlugs } from '@/lib/location-utils';
import seoData from '@/data/seo-data.json';
import { regionToCountyId, getCountySummary, getMarketWageContext } from '@/data/open-data';
import { getServiceFaqProfile, type FaqEntry } from '@/data/service-faq-intelligence';
import { getServiceHeroSlides, getIndustryHeroSlides } from '@/lib/hero-media';
import { MapPin, ShieldCheck, CheckCircle2 } from 'lucide-react';

type Props = {
    params: Promise<{
        state: string;
        county: string;
        town: string;
        service: string;
    }>;
};

function getOfferingData(offeringSlug: string) {
    const service = seoData.services.find(s => s.slug === offeringSlug);
    if (service) {
        return {
            type: 'SERVICE' as const,
            name: service.name,
            description: service.shortDescription,
            faqs: service.faqs || [],
            slug: service.slug,
        };
    }

    const industry = seoData.industries.find((i: any) => i.slug === offeringSlug);
    if (industry) {
        return {
            type: 'INDUSTRY' as const,
            name: (industry as any).name || (industry as any).heroTitle,
            description: (industry as any).heroSubtitle,
            faqs: (industry as any).faqs || [],
            slug: (industry as any).slug,
        };
    }

    return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { state, county, town, service: offeringSlug } = await params;
    
    const location = getLocationBySlugs(state, county, town);
    const offering = getOfferingData(offeringSlug);
    
    if (!location || !offering) return {};
    
    const townName = location.name.split(',')[0];
    const isDental = offering.slug === 'dental-offices';
    const title = isDental
        ? `Dental Office Janitorial & Terminal Cleaning in ${townName}, ${state.toUpperCase()} | XIRI`
        : `${offering.name} Cleaning in ${townName}, ${state.toUpperCase()} | Free Walkthrough`;
    const description = isDental
        ? `Nightly verified dental office janitorial & terminal cleaning in ${townName} (${location.region}). CDC DHCP & OSHA 1910.1030 compliant, chair-safe EPA List N disinfection, NFC proof-of-work.`
        : location.localInsight 
            ? `${location.localInsight} Professional ${offering.name.toLowerCase()} cleaning & sanitation in ${townName}. Get local pricing and request a verified quote.`
            : `Expert ${offering.name.toLowerCase()} cleaning in ${townName}, ${state.toUpperCase()}. $1M insured, OSHA compliant, nightly verified. Get a free quote.`;

    return {
        title,
        description,
        alternates: {
            canonical: `${SITE.url}/locations/${state}/${county}/${town}/${offeringSlug}`
        },
        openGraph: {
            title,
            description,
            url: `${SITE.url}/locations/${state}/${county}/${town}/${offeringSlug}`,
            siteName: SITE.name,
            type: 'website',
        },
    };
}

export default async function LocalOfferingPage({ params }: Props) {
    const { state, county, town, service: offeringSlug } = await params;
    
    const location = getLocationBySlugs(state, county, town);
    const offering = getOfferingData(offeringSlug);
    
    if (!location || !offering) {
        notFound();
    }
    
    const townName = location.name.split(',')[0].trim();
    const isDental = offering.slug === 'dental-offices';
    
    // Open-data: county-level demographics + wage context
    const countyId = regionToCountyId(location.region);
    const countySummary = countyId ? getCountySummary(countyId) : null;
    const wageContext = countyId ? getMarketWageContext(countyId) : null;

    const heroTitle = isDental
        ? `Dental Office Janitorial & Terminal Cleaning in ${townName}, ${state.toUpperCase()}`
        : `${offering.name} Cleaning in ${townName}, ${state.toUpperCase()}`;
    const heroSubtitle = isDental
        ? `Built for ${townName} dentist-owners and practice managers. Nightly CDC/OSHA operatory disinfection, sterilization lab sanitation, and NFC proof-of-work — so your hygienists treat patients instead of cleaning floors.`
        : location.localInsight
            || `${offering.description} Dedicated commercial cleaning and sanitation for facilities near ${location.landmarks?.join(', ') || location.region}.`;

    const faqProfile = getServiceFaqProfile(offering.slug);
    const dataFaqs: FaqEntry[] = [];

    dataFaqs.push({
        question: `What zip codes does XIRI cover for ${offering.name} in ${townName}?`,
        answer: `We provide specialized ${offering.name.toLowerCase()} cleaning services across zip codes ${location.zipCodes?.join(', ') || 'in the surrounding area'}, covering all of ${location.region}. Our crews maintain active routes across local business corridors.`,
    });

    if (wageContext) {
        dataFaqs.push(faqProfile.qualityFaq(townName, wageContext.medianHourly, wageContext.premiumPct, wageContext.areaTitle, wageContext.minWage));
    }

    if (countySummary && countySummary.janitorialCompetitors > 0) {
        dataFaqs.push(faqProfile.competitorFaq(townName, location.region, countySummary.janitorialCompetitors));
    }

    dataFaqs.push(faqProfile.pricingFaq(townName, offering.name));
    dataFaqs.push(faqProfile.complianceFaq(townName, offering.name));
    
    if (faqProfile.bonusFaq) {
        dataFaqs.push(faqProfile.bonusFaq(townName, offering.name));
    }

    const allFaqs = [
        ...(location.localFaqs || []),
        ...(offering.faqs || []),
        ...dataFaqs,
    ];

    const mediaSlides = getIndustryHeroSlides(offering.slug) || getServiceHeroSlides(offering.slug);

    // Schema Markup
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            '@id': `${SITE.url}/locations/${state}/${county}/${town}/${offering.slug}#business`,
            name: `${SITE.shortName} ${offering.name} Cleaning — ${location.name}`,
            description: location.localInsight || offering.description,
            image: `${SITE.url}/xiri-logo-horizontal.svg`,
            url: `${SITE.url}/locations/${state}/${county}/${town}/${offering.slug}`,
            telephone: SITE.phone,
            ...(location.lastVerified && { dateModified: location.lastVerified }),
            priceRange: '$$',
            areaServed: {
                '@type': 'Place',
                name: location.region,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: townName,
                    addressRegion: state.toUpperCase(),
                    postalCode: location.zipCodes?.[0],
                    addressCountry: 'US',
                },
            },
            ...(location.latitude && location.longitude && {
                geo: {
                    '@type': 'GeoCoordinates',
                    latitude: location.latitude,
                    longitude: location.longitude,
                }
            }),
            department: {
                '@type': 'ProfessionalService',
                name: `${offering.name} Cleaning Services`,
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE.url}/locations/${state}/${county}/${town}/${offering.slug}#service`,
            name: `${offering.name} Cleaning in ${location.name}`,
            description: offering.description,
            provider: {
                '@type': 'LocalBusiness',
                '@id': `${SITE.url}/locations/${state}/${county}/${town}/${offering.slug}#business`,
            },
            areaServed: {
                '@type': 'Place',
                name: `${townName}, ${state.toUpperCase()}`,
            },
            serviceType: `${offering.name} Cleaning`,
        }
    ];

    if (allFaqs.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage' as any,
            mainEntity: allFaqs.map(faq => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: faq.answer,
                },
            })),
        });
    }

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={jsonLd} />
            
            <Hero
                title={heroTitle}
                subtitle={heroSubtitle}
                ctaText={isDental ? `Scope My ${townName} Dental Practice` : `Get a Quote for ${townName}`}
                mediaSlides={mediaSlides}
                secondaryCta={isDental ? { text: 'Explore Dental Office Hub', href: '/industries/healthcare/dental-offices' } : undefined}
            />

            {/* Direct AI / GEO Answer Block (40–60 words) + Market Benchmarks */}
            <section className="py-12 bg-sky-50 border-y border-sky-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-sky-200 shadow-sm max-w-4xl mx-auto">
                        <p className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">
                            {isDental ? `Quick Summary · Dental Office Cleaning in ${townName}, NY` : `Quick Summary · ${offering.name} in ${townName}, NY`}
                        </p>
                        <p className="text-slate-800 text-sm sm:text-base leading-relaxed">
                            {isDental ? (
                                <>
                                    <strong>XIRI Facility Solutions</strong> provides nightly-verified <strong>dental office janitorial and terminal cleaning in {townName}, {state.toUpperCase()} ({location.region})</strong> across zip codes <strong>{location.zipCodes?.join(', ') || townName}</strong>. Built for <strong>dentist-owners (DDS/DMD) and dental office managers</strong>, our $1M+ insured teams disinfect operatories, sterilization labs, and waiting areas using chair-safe EPA List N products under CDC DHCP and OSHA 29 CFR 1910.1030 standards, verified nightly via NFC tags.
                                </>
                            ) : (
                                <>
                                    <strong>XIRI Facility Solutions</strong> provides nightly-verified <strong>{offering.name.toLowerCase()} in {townName}, {state.toUpperCase()} ({location.region})</strong> across zip codes <strong>{location.zipCodes?.join(', ') || townName}</strong>. Every shift is performed by $1M+ insured, background-checked contractors, logged via NFC zone tags, and audited by an independent Night Manager under one consolidated monthly invoice.
                                </>
                            )}
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {wageContext && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Local Wage Benchmark</p>
                                <p className="text-3xl font-bold text-sky-700 mb-2">${wageContext.medianHourly}/hr</p>
                                <p className="text-xs text-gray-400">Based on BLS data for {wageContext.areaTitle}. We pay above market to retain clinical-trained crews.</p>
                            </div>
                        )}
                        {countySummary && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Cleaners in {location.region}</p>
                                <p className="text-3xl font-bold text-sky-700 mb-2">{countySummary.janitorialCompetitors.toLocaleString()}+</p>
                                <p className="text-xs text-gray-400">We eliminate the vendor lottery with centralized vetting, NFC logs, and $1M+ COI verification.</p>
                            </div>
                        )}
                        {location.zipCodes && location.zipCodes.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Zip Codes Covered in {townName}</p>
                                <p className="text-2xl font-bold text-sky-700 mb-2 font-mono">{location.zipCodes.join(', ')}</p>
                                <p className="text-xs text-gray-400">Active nightly route density across {townName} and {location.region}.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Local Market Intelligence (Merged from IndustryHubPage so no local data is orphaned) */}
            {(location.localInsight || location.serviceChallenges || location.keyIntersection) && (
                <section className="py-16 bg-white border-b border-slate-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-12 items-start">
                            <div>
                                <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-bold uppercase tracking-wider mb-4">
                                    Local Market Intelligence · {townName}
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
                                    Why {offering.name} in {townName} Requires a Specialist
                                </h2>
                                {location.localInsight && (
                                    <p className="text-base sm:text-lg text-slate-600 mb-4 leading-relaxed">
                                        {location.localInsight}
                                    </p>
                                )}
                                {location.serviceChallenges && (
                                    <p className="text-base text-slate-600 mb-4 leading-relaxed">
                                        <strong className="text-slate-900">Local Challenge:</strong> {location.serviceChallenges}
                                    </p>
                                )}
                                {location.whyXiri && (
                                    <p className="text-base text-slate-600 leading-relaxed">
                                        <strong className="text-slate-900">The XIRI Advantage:</strong> {location.whyXiri}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-4">
                                {location.facilityTypes && location.facilityTypes.length > 0 && (
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                        <h3 className="font-bold text-slate-900 mb-3">Facilities We Service in {townName}</h3>
                                        <ul className="space-y-2 text-sm">
                                            {location.facilityTypes.map((ft, i) => (
                                                <li key={i} className="flex items-center gap-2 text-slate-700">
                                                    <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                                                    {ft}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {location.keyIntersection && (
                                    <div className="bg-sky-50 rounded-2xl p-6 border border-sky-200">
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <MapPin className="w-5 h-5 text-sky-600" />
                                            <h3 className="font-bold text-slate-900">Active Service Corridor</h3>
                                        </div>
                                        <p className="text-sm text-slate-700 leading-relaxed">
                                            Our teams operate nightly along <strong>{location.keyIntersection}</strong> and surrounding {location.region} medical and commercial corridors.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* GEO Comparison Table (Dental-Specific vs General) */}
            <section className="py-16 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">
                        {isDental
                            ? `Dental Office Cleaning in ${townName}: XIRI vs. Traditional Options`
                            : `XIRI vs. Traditional Cleaners in ${townName}`}
                    </h2>
                    <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto text-sm sm:text-base">
                        {isDental
                            ? `Why ${townName} dentist-owners and office managers replace generic janitorial crews and in-house staff cleaning with XIRI.`
                            : `How XIRI's managed accountability model compares to standard commercial cleaners in ${townName}.`}
                    </p>
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                        {isDental ? (
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        <th className="py-4 px-4 font-semibold">Clinical Benchmark</th>
                                        <th className="py-4 px-4 font-bold bg-sky-900 text-sky-200 border-x border-sky-800">XIRI Dental Protocol</th>
                                        <th className="py-4 px-4 font-semibold">Generic Office Cleaners</th>
                                        <th className="py-4 px-4 font-semibold">Using Hygienists / Assistants</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-4 px-4 font-semibold text-slate-900">Operatory &amp; Chair Safety</td>
                                        <td className="py-4 px-4 bg-sky-50/60 text-sky-950 font-medium">Chair-safe EPA List N &amp; 4-color microfiber separation</td>
                                        <td className="py-4 px-4 text-slate-500">Harsh bleach/quat sprays that crack dental upholstery</td>
                                        <td className="py-4 px-4 text-slate-500">Rushed turnover between patients</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-semibold text-slate-900">Sterilization &amp; Amalgam Zones</td>
                                        <td className="py-4 px-4 bg-sky-50/60 text-sky-950 font-medium">CDC DHCP &amp; OSHA 1910.1030 terminal cleaning</td>
                                        <td className="py-4 px-4 text-slate-500">Same mop used in restroom and sterilization lab</td>
                                        <td className="py-4 px-4 text-slate-500">Takes clinical staff away from instrument prep</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-semibold text-slate-900">Nightly Verification</td>
                                        <td className="py-4 px-4 bg-sky-50/60 text-sky-950 font-medium">NFC scan in every operatory + morning compliance log</td>
                                        <td className="py-4 px-4 text-slate-500">Unverified; discover missed rooms at 7:30 AM huddle</td>
                                        <td className="py-4 px-4 text-slate-500">No third-party audit trail for state board</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-semibold text-slate-900">Restroom &amp; Soap Supplies</td>
                                        <td className="py-4 px-4 bg-sky-50/60 text-sky-950 font-medium">Managed Georgia-Pacific dispenser &amp; paper restocking</td>
                                        <td className="py-4 px-4 text-slate-500">Office manager still orders &amp; tracks supplies</td>
                                        <td className="py-4 px-4 text-slate-500">$55–$65/hr RDH wage wasted on janitorial chores</td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border-b-2 border-gray-200 py-4 px-4 text-gray-600 font-semibold w-1/3">Feature</th>
                                        <th className="border-b-2 border-sky-500 py-4 px-4 text-sky-700 font-bold bg-sky-50 w-1/3">Xiri Facility Solutions</th>
                                        <th className="border-b-2 border-gray-200 py-4 px-4 text-gray-500 font-semibold w-1/3">Standard Cleaners</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="py-4 px-4 font-medium text-gray-900">Compliance &amp; Insurance</td>
                                        <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">OSHA/HIPAA audit ready, $1M+ Insured</td>
                                        <td className="py-4 px-4 text-gray-500">Standard janitorial only</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-medium text-gray-900">Billing &amp; Invoicing</td>
                                        <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">One Consolidated Invoice</td>
                                        <td className="py-4 px-4 text-gray-500">Multiple vendors &amp; bills</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-medium text-gray-900">Quality Assurance</td>
                                        <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">NFC Zone Logs &amp; Night Manager Audits</td>
                                        <td className="py-4 px-4 text-gray-500">Inconsistent check-ins</td>
                                    </tr>
                                    <tr>
                                        <td className="py-4 px-4 font-medium text-gray-900">Replacement Coverage</td>
                                        <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">Guaranteed Backup Crews</td>
                                        <td className="py-4 px-4 text-gray-500">Missed days if staff sick</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>

            {/* Compact UBS Arena Case Study Proof */}
            <CaseStudySpotlight variant="compact" />

            <FAQ items={allFaqs} />

            {/* Ask Any AI */}
            <section className="py-12 bg-white border-t border-slate-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <AskAnyAI
                        variant="card"
                        heading={`Ask AI About ${offering.name} Cleaning in ${townName}`}
                    />
                </div>
            </section>

            {/* Inline Lead Form Section */}
            <section id="audit" className="py-20 bg-sky-900 text-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">
                            Ready for Verified {offering.name} Cleaning in {townName}?
                        </h2>
                        <p className="text-lg text-sky-100 mb-6 leading-relaxed">
                            Book a free site walkthrough in {townName} ({location.zipCodes?.join(', ')}). We&apos;ll inspect your {isDental ? 'operatories, sterilization area, and waiting room' : 'facility'}, build a custom compliance scope, and deliver one predictable monthly quote.
                        </p>
                        {isDental && (
                            <p className="text-sm text-sky-200">
                                Want to see our full clinical protocol first?{' '}
                                <Link href="/industries/healthcare/dental-offices" className="underline font-bold text-white hover:text-sky-200">
                                    Visit the XIRI Dental Office Hub →
                                </Link>
                            </p>
                        )}
                    </div>
                    <div>
                        <ClientLeadForm
                            industryName={`${offering.name} - ${townName}`}
                            prefilledService={offering.slug}
                        />
                    </div>
                </div>
            </section>

            <NearbyAreas
                serviceSlug={offering.slug}
                serviceName={offering.name}
                nearbyCities={location.nearbyCities || []}
                currentLocationName={location.name}
            />
        </div>
    );
}
