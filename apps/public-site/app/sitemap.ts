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

    // 4. Client Location Pages (/services/[slug])
    // Pattern: [service]-in-[town]-[county]-[state]
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    services.forEach((service) => {
        (seoData.locations || []).forEach((location) => {
            const countySlug = slugify(location.region);
            const townSlug = slugify(location.name.split(',')[0]);
            const stateSlug = "ny";
            const flatSlug = `${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}`;

            sitemapEntries.push({
                url: `${BASE_URL}/services/${flatSlug}`,
                lastModified: new Date(),
                changeFrequency: 'monthly',
                priority: 0.9,
            });
        });
    });

    // 5. Partner Pages (/partners/[slug])
    // Data in PARTNER_MARKETS is already updated to new slug format
    PARTNER_MARKETS.forEach((market) => {
        // English
        sitemapEntries.push({
            url: `${BASE_URL}/partners/${market.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: {
                languages: {
                    es: `${BASE_URL}/es/partners/${market.slug}`,
                },
            },
        });

        // Spanish
        sitemapEntries.push({
            url: `${BASE_URL}/es/partners/${market.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: {
                languages: {
                    en: `${BASE_URL}/partners/${market.slug}`,
                },
            },
        });
    });

    return sitemapEntries;
}
