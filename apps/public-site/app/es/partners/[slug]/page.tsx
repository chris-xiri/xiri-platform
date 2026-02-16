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

// 2. SEO Metadata (Spanish)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const market = getMarketBySlug(slug);
    if (!market) return {};

    return generatePartnerMetadata(market, 'es');
}

// 3. Page Component (Spanish)
export default async function PartnerMarketPageEs({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const market = getMarketBySlug(slug);

    if (!market) {
        notFound();
    }

    // Get Spanish translations
    const t = market.translations?.es;

    // Dynamic Copy Construction (Spanish)
    // If specific translation exists in data, use it; else fallback to constructed string
    const headline = t?.hero?.headline || `Contratos de ${capitalize(market.trade)} en ${market.geography.town}`;
    const subheadline = t?.hero?.subheadline || `Enfoque en su oficio. Nosotros manejamos las ventas, las auditorías y la facturación para instalaciones médicas en ${capitalize(market.geography.county)}.`;

    // Construct the onboarding URL with pre-filled context and Spanish preference
    const ctaUrl = `/onboarding/start?trade=${market.trade}&zone=${market.geography.county}&source=pseo_es&market=${market.slug}&lang=es`;

    return (
        <div className="min-h-screen bg-white">
            {/* HERO SECTION (Spanish) */}
            <ContractorHero
                headline={headline}
                subheadline={subheadline}
                ctaText={`Ver Contratos Disponibles en ${market.geography.town}`}
                ctaLink={ctaUrl}
                imageSrc="/images/contractor-hero.jpg"
            />

            {/* THE XIRI ADVANTAGE SECTION (Spanish) */}
            <div className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold font-heading text-slate-900 mb-4">
                            La Ventaja Xiri para Socios de {market.geography.town}
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            No solo enviamos clientes. Construimos su densidad de ruta en {capitalize(market.geography.town)} para que deje de conducir y comience a ganar.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Pagos Puntuales (Admin Zero) */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 mb-6">
                                <DollarSign className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Pagos Puntuales</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Manejamos la facturación consolidada para que reciba su pago como reloj. Sin perseguir cheques.
                            </p>
                        </div>

                        {/* Detección de Oportunidades (Blind Spot + Bilingual) */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
                                <Eye className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Detección de Oportunidades</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Nuestros gerentes locales encuentran las necesidades; usted provee las soluciones. <span className="font-semibold text-indigo-600">Ofrecemos soporte bilingüe.</span>
                            </p>
                        </div>

                        {/* Densidad de Ruta */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 mb-6">
                                <MapPin className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Densidad de Ruta</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Agrupamos trabajos en {capitalize(market.geography.county)} para maximizar su tiempo de trabajo y minimizar el tiempo de manejo.
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <Link
                            href={ctaUrl}
                            className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all bg-sky-600 rounded-full hover:bg-sky-700 hover:shadow-lg hover:-translate-y-1 group"
                        >
                            Ver Contratos Disponibles en {market.geography.town}
                            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* LOCAL MARKET PULSE SECTION (Spanish) */}
            {(t?.localContext || market.localContext) && (
                <div className="py-20 bg-white border-b border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold font-heading text-slate-900 mb-6">
                                    Oportunidades Activas en {market.geography.town}
                                </h2>
                                <div className="space-y-6 text-lg text-slate-600">
                                    {(t?.localContext?.corridor || market.localContext?.corridor) && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Corredor Objetivo</h3>
                                                <p>Buscando instalaciones a lo largo de <strong className="text-slate-900">{t?.localContext?.corridor || market.localContext?.corridor}</strong>.</p>
                                            </div>
                                        </div>
                                    )}

                                    {market.localContext.nearbyLandmarks && market.localContext.nearbyLandmarks.length > 0 && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <MapPin className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Puntos de Referencia</h3>
                                                <p>Cerca de <strong className="text-slate-900">{market.localContext.nearbyLandmarks[0]}</strong> y <strong className="text-slate-900">{market.localContext.nearbyLandmarks[1]}</strong>.</p>
                                            </div>
                                        </div>
                                    )}

                                    {(t?.localContext?.painPoints || market.localContext?.painPoints) && (t?.localContext?.painPoints?.length ?? 0) > 0 && (
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-sky-50 rounded-full flex items-center justify-center text-sky-600">
                                                <Eye className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 mb-1">Enfoque del Servicio</h3>
                                                <p>Los clientes requieren atención a <strong className="text-slate-900">{t?.localContext?.painPoints?.[0]}</strong> y <strong className="text-slate-900">{t?.localContext?.painPoints?.[1]}</strong>.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="relative h-96 rounded-2xl overflow-hidden shadow-xl bg-slate-100">
                                {/* Geometric Abstract Map Placeholder */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <MapPin className="w-16 h-16 text-slate-300" />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-8">
                                    <div className="text-white">
                                        <p className="font-bold text-lg">Mapas de Ruta Detallados</p>
                                        <p className="opacity-90">Disponible después del registro</p>
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
