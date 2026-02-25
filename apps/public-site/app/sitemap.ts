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

    // 4. Client Location Pages (/services/[service]-in-[town]-[county]-[state])
    // Must match: services/[slug]/page.tsx generateStaticParams
    const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    services.forEach((service) => {
        (seoData.locations || []).forEach((location) => {
            const countySlug = toSlug(location.region);
            const townSlug = toSlug(location.name.split(',')[0]);
            const stateSlug = location.state.toLowerCase();

            // Match actual route: /services/{service}-in-{town}-{county}-{state}
            const flatSlug = `${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}`;

            sitemapEntries.push({
                url: `${BASE_URL}/services/${flatSlug}`,
                lastModified: new Date(),
                changeFrequency: 'monthly',
                priority: 0.9,
            });
        });
    });

    // 5. Partner Pages (/partners/[market.slug])
    // Must match: partners/[slug]/page.tsx generateStaticParams
    PARTNER_MARKETS.forEach((market) => {
        // English — uses market.slug directly (e.g., "janitorial-in-freeport-nassau-ny")
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

    // 6. Solutions Pages (/solutions/[slug])
    const solutionSlugs = [
        'medical-facility-management',
        'single-tenant-maintenance',
        'vendor-management-alternative',
    ];
    solutionSlugs.forEach((slug) => {
        sitemapEntries.push({
            url: `${BASE_URL}/solutions/${slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        });
    });

    // 7. Guide Pages (/guides/[slug])
    const guideSlugs = [
        'jcaho-cleaning-requirements',
        'commercial-cleaning-cost-guide',
        'inhouse-vs-outsourced-facility-management',
    ];
    guideSlugs.forEach((slug) => {
        sitemapEntries.push({
            url: `${BASE_URL}/guides/${slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.7,
        });
    });

    return sitemapEntries;
}
