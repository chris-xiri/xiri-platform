import { MetadataRoute } from 'next';
import { PARTNER_MARKETS } from '@/data/partnerMarkets';
import seoData from '@/data/seo-data.json';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemapEntries: MetadataRoute.Sitemap = [];

    // 1. Static Pages
    const staticPages = [
        '',
        '/contractors',
        '/contact',
        '/medical-offices',
    ];

    staticPages.forEach((route) => {
        sitemapEntries.push({
            url: `${BASE_URL}${route}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: route === '' ? 1.0 : 0.8,
        });
    });

    // 2. Industry Hubs (/[slug])
    const industries = seoData.industries || [];
    industries.forEach((item) => {
        sitemapEntries.push({
            url: `${BASE_URL}/${item.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        });
    });

    // 3. Service Hubs (/services/[slug])
    const services = seoData.services || [];
    services.forEach((item) => {
        sitemapEntries.push({
            url: `${BASE_URL}/services/${item.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        });
    });

    // 4. Client Location Pages (/services/[state]/[county]/[town])
    // Pattern: [service]/[state]/[county]/[town]
    const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    services.forEach((service) => {
        (seoData.locations || []).forEach((location) => {
            const stateParam = location.state.toLowerCase();
            const countyParam = toSlug(location.region.replace(' County', ''));
            const townParam = toSlug(location.name.split(',')[0]);

            // New Hierarchical URL
            const url = `${BASE_URL}/${service.slug}/${stateParam}/${countyParam}/${townParam}`;

            sitemapEntries.push({
                url,
                lastModified: new Date(),
                changeFrequency: 'monthly',
                priority: 0.9,
            });
        });
    });

    // 5. Partner Pages (/partners/[trade]/[state]/[county]/[town])
    PARTNER_MARKETS.forEach((market) => {
        const tradeSlug = market.trade;
        const stateSlug = market.geography.state;
        const countySlug = market.geography.county;
        const townSlug = toSlug(market.geography.town);

        const urlPath = `partners/${tradeSlug}/${stateSlug}/${countySlug}/${townSlug}`;

        // English
        sitemapEntries.push({
            url: `${BASE_URL}/${urlPath}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: {
                languages: {
                    es: `${BASE_URL}/es/${urlPath}`,
                },
            },
        });

        // Spanish
        sitemapEntries.push({
            url: `${BASE_URL}/es/${urlPath}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: {
                languages: {
                    en: `${BASE_URL}/${urlPath}`,
                },
            },
        });
    });

    return sitemapEntries;
}
