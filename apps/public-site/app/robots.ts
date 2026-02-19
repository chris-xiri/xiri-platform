import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://xiri.ai';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/private/', '/onboarding/', '/test-firebase/', '/waitlist/', '/admin/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
