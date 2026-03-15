import { NextRequest, NextResponse } from 'next/server';

// AI bot User-Agent patterns
// Maintained list of known AI crawlers and their parent organizations
const AI_BOTS: Record<string, string> = {
    'GPTBot': 'OpenAI',
    'ChatGPT-User': 'OpenAI',
    'OAI-SearchBot': 'OpenAI',
    'ClaudeBot': 'Anthropic',
    'Claude-Web': 'Anthropic',
    'PerplexityBot': 'Perplexity',
    'Google-Extended': 'Google',
    'Googlebot': 'Google',
    'Bingbot': 'Microsoft',
    'CCBot': 'Common Crawl',
    'YouBot': 'You.com',
    'Bytespider': 'ByteDance',
    'Applebot': 'Apple',
    'DuckAssistBot': 'DuckDuckGo',
    'FacebookExternalHit': 'Meta',
    'Amazonbot': 'Amazon',
    'cohere-ai': 'Cohere',
    'anthropic-ai': 'Anthropic',
    'AI2Bot': 'AI2',
    'Diffbot': 'Diffbot',
    'Meta-ExternalAgent': 'Meta',
    'PetalBot': 'Huawei',
    'Omgilibot': 'Omgili',
    'Timpibot': 'Timpi',
};

function detectAIBot(userAgent: string): { bot: string; org: string } | null {
    const ua = userAgent.toLowerCase();
    for (const [botPattern, org] of Object.entries(AI_BOTS)) {
        if (ua.includes(botPattern.toLowerCase())) {
            return { bot: botPattern, org };
        }
    }
    return null;
}

export function middleware(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || '';
    const botInfo = detectAIBot(userAgent);

    if (botInfo) {
        // Fire-and-forget: log the bot visit via internal API route
        // We use waitUntil-style approach — the response is returned immediately
        const logUrl = new URL('/api/ai-bot-log', request.url);
        const logPayload = {
            bot: botInfo.bot,
            org: botInfo.org,
            path: request.nextUrl.pathname,
            query: request.nextUrl.search,
            userAgent,
            timestamp: new Date().toISOString(),
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        };

        // Non-blocking fetch to log the visit
        fetch(logUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logPayload),
        }).catch(() => {
            // Silently ignore logging errors — don't block the response
        });
    }

    return NextResponse.next();
}

// Only run middleware on public content pages (not on static assets, _next, api, etc.)
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|css|js|txt|xml|json)).*)',
    ],
};
