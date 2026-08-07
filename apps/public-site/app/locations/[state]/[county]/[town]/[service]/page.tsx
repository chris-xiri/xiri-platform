import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { JsonLd } from '@/components/JsonLd';
import { FAQ } from '@/components/FAQ';
import { NearbyAreas } from '@/components/NearbyAreas';
import { SITE } from '@/lib/constants';
import { getLocationBySlugs } from '@/lib/location-utils';
import seoData from '@/data/seo-data.json';
import { regionToCountyId, getCountySummary, getMarketWageContext } from '@/data/open-data';
import { getServiceFaqProfile, type FaqEntry } from '@/data/service-faq-intelligence';
import { getServiceHeroSlides } from '@/lib/hero-media';

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
    const title = `${offering.name} Cleaning in ${townName}, ${state.toUpperCase()} | Free Walkthrough`;
    const description = location.localInsight 
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
    
    // Open-data: county-level demographics + wage context
    const countyId = regionToCountyId(location.region);
    const countySummary = countyId ? getCountySummary(countyId) : null;
    const wageContext = countyId ? getMarketWageContext(countyId) : null;

    const heroTitle = `${offering.name} Cleaning in ${townName}, ${state.toUpperCase()}`;
    const heroSubtitle = location.localInsight
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
                ctaText="Get a Local Quote"
                mediaSlides={getServiceHeroSlides(offering.slug)}
            />

            {/* GEO Statistics Block for AI Extraction */}
            <section className="py-12 bg-sky-50 border-y border-sky-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Local Service Insights: {townName}</h2>
                        <p className="text-gray-600">Data-driven facility management & sanitation tailored for {location.region}.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {wageContext && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Local Wage Benchmark</p>
                                <p className="text-3xl font-bold text-sky-700 mb-2">${wageContext.medianHourly}/hr</p>
                                <p className="text-xs text-gray-400">Based on BLS data for {wageContext.areaTitle}. We pay above market to retain top talent.</p>
                            </div>
                        )}
                        {countySummary && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Cleaners in {location.region}</p>
                                <p className="text-3xl font-bold text-sky-700 mb-2">{countySummary.janitorialCompetitors.toLocaleString()}+</p>
                                <p className="text-xs text-gray-400">Navigating local vendor selection? We manage vetting, audits, and insurance for you.</p>
                            </div>
                        )}
                        {location.zipCodes && location.zipCodes.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Local Coverage</p>
                                <p className="text-3xl font-bold text-sky-700 mb-2">{location.zipCodes.length}</p>
                                <p className="text-xs text-gray-400">Zip codes serviced directly in the {townName} area.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* GEO Comparison Table */}
            <section className="py-16 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                        Xiri vs. Traditional Cleaners in {townName}
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="border-b-2 border-gray-200 py-4 px-4 text-gray-600 font-semibold w-1/3">Feature</th>
                                    <th className="border-b-2 border-sky-500 py-4 px-4 text-sky-700 font-bold bg-sky-50 w-1/3 rounded-tl-lg">Xiri Facility Solutions</th>
                                    <th className="border-b-2 border-gray-200 py-4 px-4 text-gray-500 font-semibold w-1/3">Standard Cleaners</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="py-4 px-4 font-medium text-gray-900">Compliance & Insurance</td>
                                    <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">OSHA/HIPAA audit ready, $1M+ Insured</td>
                                    <td className="py-4 px-4 text-gray-500">Standard janitorial only</td>
                                </tr>
                                <tr>
                                    <td className="py-4 px-4 font-medium text-gray-900">Billing & Invoicing</td>
                                    <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">One Consolidated Invoice</td>
                                    <td className="py-4 px-4 text-gray-500">Multiple vendors & bills</td>
                                </tr>
                                <tr>
                                    <td className="py-4 px-4 font-medium text-gray-900">Quality Assurance</td>
                                    <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">Nightly Digital Logs & Audits</td>
                                    <td className="py-4 px-4 text-gray-500">Inconsistent check-ins</td>
                                </tr>
                                <tr>
                                    <td className="py-4 px-4 font-medium text-gray-900">Replacement Coverage</td>
                                    <td className="py-4 px-4 bg-sky-50 text-sky-900 font-medium">Guaranteed Backup Crews</td>
                                    <td className="py-4 px-4 text-gray-500">Missed days if staff sick</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <FAQ items={allFaqs} />

            <section className="py-16 bg-gray-50 border-t border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Ready for {offering.name} Cleaning in {townName}?
                    </h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Book a free site audit. We'll walk your facility, build a custom compliance scope, and have you covered within a week.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text={`Get Your Free Site Audit in ${townName}`}
                        className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    />
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
