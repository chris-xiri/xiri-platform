import { MetadataRoute } from 'next';
import { SITE } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;

    return {
        rules: [
            // Default rule — allow all crawlers
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/private/', '/onboarding/', '/test-firebase/', '/waitlist/', '/admin/'],
            },
            // Explicitly allow AI search crawlers (signals intent to be cited)
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ChatGPT-User', allow: '/' },
            { userAgent: 'PerplexityBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'anthropic-ai', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
