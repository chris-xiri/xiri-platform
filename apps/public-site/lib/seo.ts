import { Metadata } from "next";
import { PartnerMarket } from "@xiri/shared";

type Locale = 'en' | 'es';

export function generatePartnerMetadata(market: PartnerMarket, locale: Locale = 'en'): Metadata {
    const isEs = locale === 'es';
    const t = isEs ? market.translations?.es : null;

    // Use translated metadata if available, fallback to English (auto-generated)
    const title = t?.metaTitle || `${capitalize(market.trade)} Contracts in ${market.geography.town}, ${capitalize(market.geography.county)}, NY | Xiri Partner Network`;

    const description = t?.description || `Find high-paying ${market.trade} jobs in ${market.geography.town} (${market.geography.county}). We handle sales, marketing, and billing. Join the Xiri network today.`;

    // Construct Canonical and Hreflang URLs
    const baseUrl = 'https://xiri.ai'; // In production, use env var

    // Normalize path segments for URL
    const tradeSlug = market.trade;
    const stateSlug = market.geography.state;
    const countySlug = market.geography.county;
    const townSlug = market.geography.town.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const urlPath = `partners/${tradeSlug}/${stateSlug}/${countySlug}/${townSlug}`;

    const enUrl = `${baseUrl}/${urlPath}`;
    const esUrl = `${baseUrl}/es/${urlPath}`;
    const canonical = isEs ? esUrl : enUrl;

    return {
        title,
        description,
        alternates: {
            canonical: canonical,
            languages: {
                'en-US': enUrl,
                'es-US': esUrl,
            },
        },
        openGraph: {
            title,
            description,
            type: 'website',
            locale: isEs ? 'es_US' : 'en_US',
            url: canonical
        }
    };
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
