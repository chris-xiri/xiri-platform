import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // www → non-www (SEO canonical)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.xiri.ai' }],
        destination: 'https://xiri.ai/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
