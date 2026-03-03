import { MetadataRoute } from 'next';
import seoData from '@/data/seo-data.json';
import { DLP_SOLUTIONS, SPOKE_HUBS } from '@/data/dlp-solutions';
import { TRADES, KEYWORD_PAGES, GUIDE_PAGES, getGeoPages } from '@/data/dlp-contractors';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemapEntries: MetadataRoute.Sitemap = [];
    const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 1. Static Pages
    ['', '/contractors', '/contact', '/directory/locations', '/directory/solutions'].forEach((route) => {
        sitemapEntries.push({ url: `${BASE_URL}${route}`, lastModified: new Date(), changeFrequency: 'weekly', priority: route === '' ? 1.0 : 0.8 });
    });

    // 2. Industry Hubs (/[slug])
    (seoData.industries || []).forEach((item) => {
        sitemapEntries.push({ url: `${BASE_URL}/${item.slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 });
    });

    // 3. Service Hubs (/services/[slug])
    const services = seoData.services || [];
    services.forEach((item) => {
        sitemapEntries.push({ url: `${BASE_URL}/services/${item.slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 });
    });

    // 4. Service × Location Pages (core money pages — enriched content)
    const locations = seoData.locations || [];
    services.forEach((service) => {
        locations.forEach((location) => {
            const countySlug = toSlug(location.region);
            const townSlug = toSlug(location.name.split(',')[0]);
            const stateSlug = location.state.toLowerCase();
            sitemapEntries.push({ url: `${BASE_URL}/services/${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 });
        });
    });
    // NOTE: Industry × Location pages (960) excluded from sitemap to protect crawl budget.
    // Pages still exist and are accessible — just not submitted to Google.

    // 5. Solutions — Editorial + DLP + Spoke Hubs
    ['medical-facility-management', 'single-tenant-maintenance', 'vendor-management-alternative'].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/solutions/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 });
    });
    Object.keys(SPOKE_HUBS).forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/solutions/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });
    Object.keys(DLP_SOLUTIONS).forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/solutions/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });

    // 7. Contractor DLPs
    [...Object.keys(TRADES), ...Object.keys(getGeoPages()), ...Object.keys(KEYWORD_PAGES), ...Object.keys(GUIDE_PAGES)].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/contractors/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });

    // NOTE: Solutions DLP × Location pages (768) excluded from sitemap — thin content.
    // Pages still exist and are accessible — just not submitted to Google.

    // 9. Contractor — Janitorial × Location only (focus crawl budget)
    const SITEMAP_TRADES = ['janitorial-subcontractor'];
    SITEMAP_TRADES.forEach((tradeSlug) => {
        locations.forEach((location) => {
            sitemapEntries.push({ url: `${BASE_URL}/contractors/${tradeSlug}-in-${(location as any).slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 });
        });
    });
    // NOTE: Other trades × location (320 pages) excluded from sitemap.
    // Pages still live — just not submitted to Google.

    // 10. Guide Pages
    ['jcaho-cleaning-requirements', 'accreditation-360-preparation-guide', 'commercial-cleaning-cost-guide', 'inhouse-vs-outsourced-facility-management'].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/guides/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });

    return sitemapEntries;
}

