import { Metadata } from 'next';
import { SITE } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Free Compliance Readiness Checker — OSHA, HIPAA, CMS, AAAHC | XIRI',
    description: 'Free tool: Assess your facility\'s cleaning compliance across OSHA, HIPAA, CMS, AAAHC, and NYS regulations in under 3 minutes. Get a score with specific recommendations.',
    alternates: {
        canonical: 'https://xiri.ai/tools/compliance-checker',
    },
    openGraph: {
        title: 'Facility Compliance Readiness Checker',
        description: 'Free compliance assessment for medical offices, surgery centers, dialysis clinics and more. Score your cleaning program across 5 major regulations.',
        url: 'https://xiri.ai/tools/compliance-checker',
        siteName: SITE.name,
        type: 'website',
    },
};

export default function ComplianceCheckerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
