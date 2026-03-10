import type { NextConfig } from "next";

// ─── Industry Pillar Redirect Mapping ──────────────────────────────
// Maps old flat industry slugs to their new pillar-nested paths
const INDUSTRY_TO_PILLAR: Record<string, string> = {
  'medical-offices': 'healthcare',
  'urgent-care': 'healthcare',
  'surgery-centers': 'healthcare',
  'dental-offices': 'healthcare',
  'dialysis-centers': 'healthcare',
  'converted-clinical-suites': 'healthcare',
  'veterinary-clinics': 'healthcare',
  'auto-dealerships': 'automotive',
  'daycare-preschool': 'education',
  'private-schools': 'education',
  'professional-offices': 'commercial',
  'retail-storefronts': 'commercial',
  'fitness-gyms': 'commercial',
  'labs-cleanrooms': 'specialized',
  'light-manufacturing': 'specialized',
};

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    const redirects: any[] = [];

    for (const [slug, pillar] of Object.entries(INDUSTRY_TO_PILLAR)) {
      // Old root-level URLs: /medical-offices → /industries/healthcare/medical-offices
      redirects.push({
        source: `/${slug}`,
        destination: `/industries/${pillar}/${slug}`,
        permanent: true,
      });

      // Old flat industry URLs: /industries/medical-offices → /industries/healthcare/medical-offices
      redirects.push({
        source: `/industries/${slug}`,
        destination: `/industries/${pillar}/${slug}`,
        permanent: true,
      });

      // Old service-style URLs: /services/medical-offices → /industries/healthcare/medical-offices
      redirects.push({
        source: `/services/${slug}`,
        destination: `/industries/${pillar}/${slug}`,
        permanent: true,
      });

      // Old industry×location URLs: /services/medical-offices-in-:location* → /industries/healthcare/medical-offices-in-:location*
      redirects.push({
        source: `/services/${slug}-in-:location*`,
        destination: `/industries/${pillar}/${slug}-in-:location*`,
        permanent: true,
      });
    }

    // /pricing → /calculator (nav label says "Pricing" but page lives at /calculator)
    redirects.push({
      source: '/pricing',
      destination: '/calculator',
      permanent: true,
    });

    return redirects;
  },
};

export default nextConfig;
