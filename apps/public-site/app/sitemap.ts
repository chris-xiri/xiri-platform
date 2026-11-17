import { MetadataRoute } from 'next';
import seoData from '@/data/seo-data.json';
import { DLP_SOLUTIONS, SPOKE_HUBS } from '@/data/dlp-solutions';
import { TRADES, KEYWORD_PAGES, GUIDE_PAGES, getGeoPages } from '@/data/dlp-contractors';
import { GUIDES, REGULATION_GUIDE_SLUGS } from '@/data/guides';
import { LOCATIONS } from '@/lib/locations';
import { INDUSTRY_PILLARS, getPillarForIndustry } from '@/lib/industry-pillars';
import { BLOG_POSTS } from '@/data/blog-posts';
import { COMPARISON_PAGES } from '@/data/dlp-comparisons';
import { getAllFacilityRfpPresetSlugs } from '@/lib/rfp-facility-presets';
import { SITE } from '@/lib/constants';
import { SITEMAP_CONTRACTOR_TRADE_SLUGS, SITEMAP_LEAD_SERVICE_SLUGS, SITEMAP_STATIC_ROUTES } from '@/lib/seo-rules';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;
const OVERLAP_LEAD_LOCATION_SLUGS = new Set(['janitorial-services', 'commercial-cleaning']);
const RELEASE_DATE = new Date('2026-11-16T00:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
    const sitemapEntries: MetadataRoute.Sitemap = [];
    const toSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 1. Static Pages
    SITEMAP_STATIC_ROUTES.forEach((route) => {
        const isHighPriority = route === '' || route.includes('case-studies') || route.includes('cleaning-verification');
        sitemapEntries.push({
            url: `${BASE_URL}${route}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'weekly',
            priority: route === '' ? 1.0 : isHighPriority ? 0.9 : 0.8,
        });
    });

    // 1b. Blog Posts (imported from data/blog-posts.ts with real publishDate)
    BLOG_POSTS.forEach(({ slug, publishDate }) => {
        const postDate = publishDate ? new Date(publishDate) : RELEASE_DATE;
        sitemapEntries.push({
            url: `${BASE_URL}/blog/${slug}`,
            lastModified: isNaN(postDate.getTime()) ? RELEASE_DATE : postDate,
            changeFrequency: 'monthly',
            priority: 0.75,
        });
    });

    // 2. Industry Pillar Hubs (/industries/healthcare, /industries/automotive, etc.)
    INDUSTRY_PILLARS.forEach((pillar) => {
        sitemapEntries.push({
            url: `${BASE_URL}/industries/${pillar.slug}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'weekly',
            priority: pillar.slug === 'healthcare' ? 0.95 : 0.9,
        });
    });

    // 2b. Industry Pages (/industries/[pillar]/[slug]) — Dental Offices boosted to 1.0
    (seoData.industries || []).forEach((item) => {
        const pillar = getPillarForIndustry(item.slug);
        if (pillar) {
            sitemapEntries.push({
                url: `${BASE_URL}/industries/${pillar.slug}/${item.slug}`,
                lastModified: RELEASE_DATE,
                changeFrequency: 'weekly',
                priority: item.slug === 'dental-offices' ? 1.0 : 0.85,
            });
        }
    });

    // 3. Service Hubs (/services/[slug])
    const services = seoData.services || [];
    services.forEach((item) => {
        sitemapEntries.push({
            url: `${BASE_URL}/services/${item.slug}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'weekly',
            priority: 0.9,
        });
    });

    // 4. Locations Hubs & Service × Location Pages
    const locations = seoData.locations || [];
    const states = new Set(locations.map(loc => loc.state));
    
    // Top-level hub
    sitemapEntries.push({ url: `${BASE_URL}/locations`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.9 });
    
    // State hubs
    states.forEach(state => {
        const stateSlug = toSlug(state);
        sitemapEntries.push({ url: `${BASE_URL}/locations/${stateSlug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.8 });
    });

    // County hubs, Town Hubs, and Service pages
    locations.forEach((location) => {
        const stateSlug = toSlug(location.state);
        const countySlug = toSlug(location.region);
        const townSlug = toSlug(location.name.split(',')[0]);
        const locDate = (location as any).lastVerified ? new Date((location as any).lastVerified) : RELEASE_DATE;
        const validLocDate = isNaN(locDate.getTime()) ? RELEASE_DATE : locDate;
        
        // Town Hub
        sitemapEntries.push({ url: `${BASE_URL}/locations/${stateSlug}/${countySlug}/${townSlug}`, lastModified: validLocDate, changeFrequency: 'weekly', priority: 0.75 });
        
        // Service × Location Pages (core cleaning services only for crawl budget)
        services.filter((s) => SITEMAP_LEAD_SERVICE_SLUGS.includes(s.slug as any)).forEach((service) => {
            const isOverlapLeadLocation = OVERLAP_LEAD_LOCATION_SLUGS.has(service.slug);
            sitemapEntries.push({
                url: `${BASE_URL}/locations/${stateSlug}/${countySlug}/${townSlug}/${service.slug}`,
                lastModified: validLocDate,
                changeFrequency: isOverlapLeadLocation ? 'yearly' : 'monthly',
                priority: isOverlapLeadLocation ? 0.6 : 0.9,
            });
        });

        // High-Priority Industry × Location Pages (Dental prioritized at 0.98)
        const TARGET_INDUSTRY_SLUGS = [
            'dental-offices',
            'urgent-care',
            'auto-dealerships',
            'fitness-gyms',
            'medical-offices',
            'physical-therapy',
            'chiropractors',
            'libraries',
            'surgery-centers',
            'dialysis-centers'
        ];
        const industries = seoData.industries || [];
        industries.filter((i: any) => TARGET_INDUSTRY_SLUGS.includes(i.slug)).forEach((ind: any) => {
            sitemapEntries.push({
                url: `${BASE_URL}/locations/${stateSlug}/${countySlug}/${townSlug}/${ind.slug}`,
                lastModified: validLocDate,
                changeFrequency: 'weekly',
                priority: ind.slug === 'dental-offices' ? 0.98 : 0.9,
            });
        });
        // Town Provider Comparison Page
        sitemapEntries.push({ url: `${BASE_URL}/locations/${stateSlug}/${countySlug}/${townSlug}/compare`, lastModified: validLocDate, changeFrequency: 'weekly', priority: 0.85 });
    });

    // 4b. Research Reports (Programmatic Link Building Engine)
    sitemapEntries.push({ url: `${BASE_URL}/research`, lastModified: RELEASE_DATE, changeFrequency: 'weekly', priority: 0.9 });
    [
        'ny-commercial-sanitation-index',
        'queens-medical-facility-sanitation-report',
        'long-island-industrial-cleaning-report',
    ].forEach((reportSlug) => {
        sitemapEntries.push({ url: `${BASE_URL}/research/${reportSlug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.95 });
    });

    // 5. Solutions — Editorial + Verification Spoke + DLP + Spoke Hubs
    [
        'medical-facility-management',
        'single-tenant-maintenance',
        'vendor-management-alternative',
        'cleaning-verification/nfc-proof-of-work',
        'cleaning-verification/digital-compliance-log',
        'cleaning-verification/keep-your-cleaner',
    ].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/solutions/${slug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.85 });
    });
    Object.keys(SPOKE_HUBS).forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/solutions/${slug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.75 });
    });
    Object.keys(DLP_SOLUTIONS).forEach((slug) => {
        sitemapEntries.push({
            url: `${BASE_URL}/solutions/${slug}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'monthly',
            priority: slug === 'dental-suite-sanitization' ? 0.95 : 0.75,
        });
    });

    // 7. Contractor DLPs
    [...Object.keys(TRADES), ...Object.keys(getGeoPages()), ...Object.keys(KEYWORD_PAGES), ...Object.keys(GUIDE_PAGES)].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/contractors/${slug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.6 });
    });

    // 9. Contractor — Janitorial × Location only (focus crawl budget)
    SITEMAP_CONTRACTOR_TRADE_SLUGS.forEach((tradeSlug) => {
        locations.forEach((location) => {
            sitemapEntries.push({ url: `${BASE_URL}/contractors/${tradeSlug}-in-${(location as any).slug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.5 });
        });
    });

    // 10. Guide Pages (imported from data/guides.ts with real dateModified)
    Object.entries(GUIDES).forEach(([slug, guide]) => {
        const gDate = guide.dateModified ? new Date(guide.dateModified) : RELEASE_DATE;
        const isDentalGuide = slug.includes('dental');
        sitemapEntries.push({
            url: `${BASE_URL}/guides/${slug}`,
            lastModified: isNaN(gDate.getTime()) ? RELEASE_DATE : gDate,
            changeFrequency: 'monthly',
            priority: isDentalGuide ? 0.95 : 0.75,
        });
    });

    // 11. Regulation × Location Pages (5 regulations × 15 locations = 75 pages)
    REGULATION_GUIDE_SLUGS.forEach((regSlug) => {
        LOCATIONS.forEach((loc) => {
            const countySlug = loc.county.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            sitemapEntries.push({ url: `${BASE_URL}/guides/${regSlug}-in-${loc.slug}-${countySlug}-ny`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.65 });
        });
    });

    // 12. Free Tools & Facility RFP Generators
    ['janitorial-rfp', 'compliance-checker', 'sds-lookup'].forEach((tool) => {
        sitemapEntries.push({ url: `${BASE_URL}/tools/${tool}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.7 });
    });
    getAllFacilityRfpPresetSlugs().forEach((facilitySlug) => {
        sitemapEntries.push({
            url: `${BASE_URL}/tools/janitorial-rfp/${facilitySlug}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'monthly',
            priority: facilitySlug === 'dental-offices' ? 0.95 : 0.75,
        });
    });

    // 13. Comparison / Alternative Pages (AI citation magnets)
    Object.keys(COMPARISON_PAGES).forEach((slug) => {
        const isDentalCompare = slug.includes('dental');
        sitemapEntries.push({
            url: `${BASE_URL}/compare/${slug}`,
            lastModified: RELEASE_DATE,
            changeFrequency: 'monthly',
            priority: isDentalCompare ? 0.95 : 0.85,
        });
    });

    // 14. Referral Partner Pages (hub + 12 trade pages)
    ['plumber-referral-partner', 'electrician-referral-partner', 'hvac-referral-partner',
     'pest-control-referral-partner', 'fire-protection-referral-partner', 'elevator-service-referral-partner',
     'locksmith-referral-partner', 'property-manager-referral-partner', 'commercial-real-estate-broker-referral-partner',
     'accountant-referral-partner', 'insurance-agent-referral-partner', 'security-company-referral-partner',
    ].forEach((slug) => {
        sitemapEntries.push({ url: `${BASE_URL}/refer/${slug}`, lastModified: RELEASE_DATE, changeFrequency: 'monthly', priority: 0.6 });
    });

    return sitemapEntries;
}
