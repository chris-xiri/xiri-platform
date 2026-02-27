import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Partner Onboarding — XIRI Facility Solutions',
    description:
        'Complete your contractor profile to join the XIRI partner network. Get matched with local medical offices, commercial facilities, and more — one application, 5 minutes.',
    openGraph: {
        title: 'Join the XIRI Partner Network',
        description:
            'Complete your 5-minute profile to start receiving facility service opportunities in your area. One point of contact, consistent work, fast payouts.',
        siteName: 'XIRI Facility Solutions',
        type: 'website',
        url: 'https://xiri.ai/onboarding',
        images: [
            {
                url: 'https://xiri.ai/og-partner-onboarding.png',
                width: 1200,
                height: 630,
                alt: 'XIRI Partner Network — Join as a Service Provider',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Join the XIRI Partner Network',
        description:
            'Complete your profile to start receiving facility service opportunities. Fast payouts, consistent work, zero admin overhead.',
        images: ['https://xiri.ai/og-partner-onboarding.png'],
    },
    robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
