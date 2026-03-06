import type { NextConfig } from "next";

const INDUSTRY_SLUGS = [
  'medical-offices', 'urgent-care', 'surgery-centers', 'auto-dealerships',
  'daycare-preschool', 'dental-offices', 'dialysis-centers', 'veterinary-clinics',
  'fitness-gyms', 'professional-offices', 'private-schools', 'retail-storefronts',
  'labs-cleanrooms', 'light-manufacturing', 'converted-clinical-suites',
];

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return INDUSTRY_SLUGS.map((slug) => ({
      source: `/${slug}`,
      destination: `/industries/${slug}`,
      permanent: true, // 301
    }));
  },
};

export default nextConfig;
