import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import seoData from '@/data/seo-data.json';
import { IndustryHubPage } from '@/components/IndustryHubPage';
import { INDUSTRY_PILLARS, getPillarForIndustry } from '@/lib/industry-pillars';

type Props = {
    params: Promise<{ pillar: string; slug: string }>;
};

// ─── STATIC PARAMS ─────────────────────────────────────────────────

export async function generateStaticParams() {
    const params: { pillar: string; slug: string }[] = [];
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    for (const pillar of INDUSTRY_PILLARS) {
        for (const industrySlug of pillar.industries) {
            // 1. Industry hub page (e.g., /industries/healthcare/medical-offices)
            params.push({ pillar: pillar.slug, slug: industrySlug });

            // 2. Industry × Location pages (e.g., /industries/healthcare/medical-offices-in-garden-city-nassau-ny)
            for (const location of seoData.locations) {
                const countySlug = slugify(location.region);
                const townSlug = slugify(location.name.split(',')[0]);
                params.push({
                    pillar: pillar.slug,
                    slug: `${industrySlug}-in-${townSlug}-${countySlug}-ny`,
                });
            }
        }
    }

    return params;
}

// ─── SLUG PARSING ──────────────────────────────────────────────────

interface Location {
    slug: string;
    name: string;
    state: string;
    region: string;
    latitude?: number;
    longitude?: number;
    population?: string;
    medicalDensity?: string;
    keyIntersection?: string;
    localInsight?: string;
    complianceNote?: string;
    serviceChallenges?: string;
    whyXiri?: string;
    facilityTypes?: string[];
    landmarks?: string[];
    nearbyCities?: string[];
    zipCodes?: string[];
    localFaqs?: { question: string; answer: string }[];
}

function parseIndustrySlug(pillarSlug: string, slug: string) {
    const pillar = INDUSTRY_PILLARS.find(p => p.slug === pillarSlug);
    if (!pillar) return { type: 'NOT_FOUND' as const, data: null };

    // 1. Direct industry match
    const industry = seoData.industries.find((i: any) => i.slug === slug);
    if (industry && pillar.industries.includes(slug)) {
        return { type: 'INDUSTRY' as const, data: { industry, pillar } };
    }

    // 2. Industry × Location match
    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const matchingIndustry = seoData.industries.find((i: any) =>
        pillar.industries.includes(i.slug) && slug.startsWith(i.slug + '-in-')
    );
    if (matchingIndustry) {
        const locationPart = slug.substring(matchingIndustry.slug.length + 4);
        const matchingLocation = seoData.locations.find(loc => {
            const townSlug = slugify(loc.name.split(',')[0]);
            const countySlug = slugify(loc.region);
            return `${townSlug}-${countySlug}-ny` === locationPart;
        });
        if (matchingLocation) {
            return {
                type: 'INDUSTRY_LOCATION' as const,
                data: { industry: matchingIndustry, location: matchingLocation as Location, pillar },
            };
        }
    }

    return { type: 'NOT_FOUND' as const, data: null };
}

// ─── METADATA ──────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { pillar: pillarSlug, slug } = await params;
    const parsed = parseIndustrySlug(pillarSlug, slug);

    if (parsed.type === 'INDUSTRY') {
        const { industry, pillar } = parsed.data!;
        return {
            title: `${(industry as any).heroTitle || (industry as any).name} | XIRI`,
            description: (industry as any).heroSubtitle,
            alternates: { canonical: `https://xiri.ai/industries/${pillar.slug}/${(industry as any).slug}` },
            openGraph: {
                title: `${(industry as any).heroTitle || (industry as any).name} | XIRI`,
                description: (industry as any).heroSubtitle,
                url: `https://xiri.ai/industries/${pillar.slug}/${(industry as any).slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    }

    if (parsed.type === 'INDUSTRY_LOCATION') {
        const { industry, location, pillar } = parsed.data!;
        const townName = location.name.split(',')[0].trim();
        const title = `${(industry as any).name} Cleaning in ${location.name} | XIRI`;
        const description = `${(industry as any).heroSubtitle?.slice(0, 80) || ''} Serving ${townName} and ${location.region}. $1M insured, nightly verified.`.slice(0, 155);
        return {
            title,
            description,
            alternates: { canonical: `https://xiri.ai/industries/${pillar.slug}/${slug}` },
            openGraph: { title, description, url: `https://xiri.ai/industries/${pillar.slug}/${slug}` },
        };
    }

    return {};
}

// ─── PAGE ──────────────────────────────────────────────────────────

export default async function IndustryDetailPage({ params }: Props) {
    const { pillar: pillarSlug, slug } = await params;
    const parsed = parseIndustrySlug(pillarSlug, slug);

    if (parsed.type === 'NOT_FOUND') notFound();

    if (parsed.type === 'INDUSTRY') {
        const { industry, pillar } = parsed.data!;
        return (
            <IndustryHubPage
                industry={industry as any}
                pillar={{ href: `/industries/${pillar.slug}`, text: pillar.name }}
            />
        );
    }

    if (parsed.type === 'INDUSTRY_LOCATION') {
        const { industry, location, pillar } = parsed.data!;
        return (
            <IndustryHubPage
                industry={industry as any}
                pillar={{ href: `/industries/${pillar.slug}`, text: pillar.name }}
                location={location}
            />
        );
    }

    notFound();
}
