import { MetadataRoute } from 'next';
import { SITE } from '@/lib/constants';
import { SEO_ROBOTS_DISALLOW } from '@/lib/seo-rules';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;

    return {
        rules: [
            // Default rule — allow all crawlers
            {
                userAgent: '*',
                allow: '/',
                disallow: [...SEO_ROBOTS_DISALLOW],
            },
            // Explicitly allow AI search crawlers (signals intent to be cited)
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ChatGPT-User', allow: '/' },
            { userAgent: 'PerplexityBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'anthropic-ai', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
            { userAgent: 'PetalBot', disallow: '/' },
            { userAgent: 'HuaweiBot', disallow: '/' },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
