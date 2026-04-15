import { notFound, permanentRedirect } from "next/navigation";
import seoData from "@/data/seo-data.json";
import { getPillarForIndustry } from "@/lib/industry-pillars";

type LegacyIndustryRouteProps = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    return seoData.industries.map((ind) => ({ slug: ind.slug }));
}

export default async function LegacyIndustryPage({ params }: LegacyIndustryRouteProps) {
    const { slug } = await params;
    const industry = seoData.industries.find((i) => i.slug === slug);

    if (!industry) {
        notFound();
    }

    const pillar = getPillarForIndustry(slug);
    if (!pillar) {
        notFound();
    }

    permanentRedirect(`/industries/${pillar.slug}/${slug}`);
}
