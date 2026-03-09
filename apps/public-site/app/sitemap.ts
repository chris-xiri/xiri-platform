import { MetadataRoute } from 'next';
import seoData from '@/data/seo-data.json';
import { DLP_SOLUTIONS, SPOKE_HUBS } from '@/data/dlp-solutions';
import { TRADES, KEYWORD_PAGES, GUIDE_PAGES, getGeoPages } from '@/data/dlp-contractors';
import { REGULATION_GUIDE_SLUGS } from '@/data/guides';
import { LOCATIONS } from '@/lib/locations';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemapEntries: MetadataRoute.Sitemap = [];
    const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 1. Static Pages
    ['', '/contractors', '/contact', '/directory/locations', '/directory/solutions', '/about', '/services', '/solutions', '/industries', '/blog'].forEach((route) => {
        sitemapEntries.push({ url: `${BASE_URL}${route}`, lastModified: new Date(), changeFrequency: 'weekly', priority: route === '' ? 1.0 : 0.8 });
    });

    // 1b. Blog Posts
    [
        'how-much-does-commercial-cleaning-cost', 'in-house-vs-outsourced-facility-management',
        'medical-office-cleaning-compliance-checklist', 'how-to-evaluate-commercial-cleaning-company',
        'jcaho-cleaning-requirements-guide', 'what-is-a-day-porter-and-do-you-need-one',
        'commercial-floor-care-guide', 'how-to-reduce-facility-management-costs',
        'nassau-county-commercial-cleaning-guide', 'what-to-expect-from-post-construction-cleaning',
        'why-your-cleaning-company-keeps-no-showing', 'commercial-trash-recycling-mistakes',
        'urgent-care-cleaning-requirements', 'green-cleaning-commercial-buildings',
        'hvac-maintenance-schedule-commercial', 'dental-office-cleaning-osha-requirements',
        'facility-management-for-auto-dealerships', 'daycare-cleaning-safety-guide',
        'pressure-washing-for-commercial-properties',
    ].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/blog/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });

    // 2. Industry Hubs (/industries/[slug])
    (seoData.industries || []).forEach((item) => {
        sitemapEntries.push({ url: `${BASE_URL}/industries/${item.slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 });
    });

    // 3. Service Hubs (/services/[slug])
    const services = seoData.services || [];
    services.forEach((item) => {
        sitemapEntries.push({ url: `${BASE_URL}/services/${item.slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 });
    });

    // 4. Service × Location Pages — core cleaning services only (crawl budget)
    const SITEMAP_SERVICES = [
        'medical-office-cleaning',
        'urgent-care-cleaning',
        'janitorial-services',
        'commercial-cleaning',
        'day-porter',
    ];
    const locations = seoData.locations || [];
    services.filter((s) => SITEMAP_SERVICES.includes(s.slug)).forEach((service) => {
        locations.forEach((location) => {
            const countySlug = toSlug(location.region);
            const townSlug = toSlug(location.name.split(',')[0]);
            const stateSlug = location.state.toLowerCase();
            sitemapEntries.push({ url: `${BASE_URL}/services/${service.slug}-in-${townSlug}-${countySlug}-${stateSlug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 });
        });
    });
    // NOTE: Other 14 services × location (896 pages) excluded from sitemap.
    // Industry × Location (960 pages) also excluded.
    // All pages remain live — just not submitted to Google.

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
    ['jcaho-cleaning-requirements', 'accreditation-360-preparation-guide', 'commercial-cleaning-cost-guide', 'inhouse-vs-outsourced-facility-management',
        'osha-bloodborne-pathogen-cleaning-standard', 'hipaa-environmental-compliance-cleaning', 'nys-part-226-voc-cleaning-compliance', 'cms-conditions-for-coverage-cleaning', 'aaahc-surgery-center-cleaning-standards',
    ].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/guides/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 });
    });

    // 11. Regulation × Location Pages (5 regulations × 15 locations = 75 pages)
    REGULATION_GUIDE_SLUGS.forEach((regSlug) => {
        LOCATIONS.forEach((loc) => {
            const countySlug = loc.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            sitemapEntries.push({ url: `${BASE_URL}/guides/${regSlug}-in-${loc.slug}-${countySlug}-ny`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 });
        });
    });

    // 12. Free Tools (backlink magnets)
    ['compliance-checker', 'sds-lookup'].forEach((tool) => {
        sitemapEntries.push({ url: `${BASE_URL}/tools/${tool}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 });
    });

    return sitemapEntries;
}

