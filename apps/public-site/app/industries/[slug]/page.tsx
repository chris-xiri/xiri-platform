
import { notFound } from "next/navigation";
import { Metadata } from "next";
import seoData from "@/data/seo-data.json";
import { IndustryHubPage } from "@/components/IndustryHubPage";

// 1. Static Paths for Industries
export async function generateStaticParams() {
    return seoData.industries.map((ind) => ({
        slug: ind.slug,
    }));
}

// 2. Metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const industry = seoData.industries.find((i) => i.slug === slug);

    if (industry) {
        return {
            title: `${industry.heroTitle} | XIRI`,
            description: industry.heroSubtitle,
            alternates: {
                canonical: `https://xiri.ai/industries/${industry.slug}`
            },
            openGraph: {
                title: `${industry.heroTitle} | XIRI`,
                description: industry.heroSubtitle,
                url: `https://xiri.ai/industries/${industry.slug}`,
                siteName: 'XIRI Facility Solutions',
                type: 'website',
            },
        };
    }

    return {};
}

// 3. Page Component
export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const industry = seoData.industries.find((i) => i.slug === slug);

    if (!industry) {
        notFound();
    }

    return <IndustryHubPage industry={industry as any} />;
}
