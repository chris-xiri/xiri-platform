import { notFound } from "next/navigation";
import { Metadata } from "next";
import { PARTNER_MARKETS, getMarketBySlug } from "@/data/partnerMarkets";
import { generatePartnerMetadata } from "@/lib/seo";
import { ContractorHero } from "@/components/ContractorHero";
import Link from "next/link";
import { DollarSign, Eye, MapPin } from "lucide-react";

// 1. Pre-build pages for high performance (SSG)
export async function generateStaticParams() {
    return PARTNER_MARKETS.map((market) => ({
        slug: market.slug,
    }));
}

// 2. SEO Metadata (English)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const market = getMarketBySlug(slug);
    if (!market) return {};

    return generatePartnerMetadata(market, 'en');
}

// 3. Page Component (English)
export default async function PartnerMarketPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const market = getMarketBySlug(slug);

    if (!market) {
        notFound();
    }

    // Dynamic Copy Construction
    const headline = `Commercial ${capitalize(market.trade)} Contracts in ${market.geography.town}.`;
    const subheadline = `Focus on your craft. We handle the sales, the compliance audits, and the billing for ${capitalize(market.geography.county)} medical and auto facilities.`;

    // Construct the onboarding URL with pre-filled context
    const ctaUrl = `/onboarding/start?trade=${market.trade}&zone=${market.geography.county}&source=pseo&market=${market.slug}`;

    return (
        <div className="min-h-screen bg-white">
            {/* HERO SECTION */}
            <ContractorHero
                headline={headline}
                subheadline={subheadline}
                ctaText={`View Available Contracts in ${market.geography.town}`}
                ctaLink={ctaUrl}
                imageSrc="/images/contractor-hero.jpg"
            />

            {/* THE XIRI ADVANTAGE SECTION */}
            <div className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            The Xiri Advantage for {market.geography.town} Partners
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            We don't just send leads. We build your route density in {capitalize(market.geography.town)} so you can stop driving and start earning.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Admin Zero */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 mb-6">
                                <DollarSign className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Admin Zero</h3>
                            <p className="text-slate-600 leading-relaxed">
                                We handle consolidated invoicing so you get paid like clockwork. No more chasing clients for checks.
                            </p>
                        </div>

                        {/* Blind Spot Detection */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
                                <Eye className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Blind Spot Detection</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Our local Facility Solutions Managers (FSMs) find the maintenance needs; you provide the solutions.
                            </p>
                        </div>

                        {/* Route Density */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 mb-6">
                                <MapPin className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Route Density</h3>
                            <p className="text-slate-600 leading-relaxed">
                                We cluster jobs in {capitalize(market.geography.county)} to maximize your "wrench-time" and minimize windshield time.
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <Link
                            href={ctaUrl}
                            className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all bg-sky-600 rounded-full hover:bg-sky-700 hover:shadow-lg hover:-translate-y-1 group"
                        >
                            View Available Contracts in {market.geography.town}
                            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* LOCAL MARKET PULSE SECTION */}
            {market.localContext && (
                <div className="py-20 bg-white border-b border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold font-heading text-slate-900 mb-6">
                                    Active Opportunities in {market.geography.town}
                                </h2>
                                <div className="space-y-6 text-lg text-slate-600">
                                    {market.localContext.corridor && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Target Corridor</h3>
                                                <p>Targeting facilities along <strong className="text-slate-900">{market.localContext.corridor}</strong>.</p>
                                            </div>
                                        </div>
                                    )}

                                    {market.localContext.nearbyLandmarks && market.localContext.nearbyLandmarks.length > 0 && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Key Landmarks</h3>
                                                <p>Sourcing partners for sites near <strong className="text-slate-900">{market.localContext.nearbyLandmarks[0]}</strong> and <strong className="text-slate-900">{market.localContext.nearbyLandmarks[1]}</strong>.</p>
                                            </div>
                                        </div>
                                    )}

                                    {market.localContext.painPoints && market.localContext.painPoints.length > 0 && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <Eye className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Service Focus</h3>
                                                <p>Clients require attention to <strong className="text-slate-900">{market.localContext.painPoints[0]}</strong> and <strong className="text-slate-900">{market.localContext.painPoints[1]}</strong>.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="relative h-96 rounded-2xl overflow-hidden shadow-xl bg-slate-100">
                                {/* Geometric Abstract Map Placeholder as fallback */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <MapPin className="w-16 h-16 text-slate-300" />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-8">
                                    <div className="text-white">
                                        <p className="font-bold text-lg">Detailed Route Maps</p>
                                        <p className="opacity-90">Available after onboarding</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
