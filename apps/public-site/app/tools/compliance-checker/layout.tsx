import { Metadata } from 'next';
import { SITE } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Facility Compliance Readiness Checker for Owners & Managers | XIRI',
    description: 'Free tool for facility managers, business owners, and property operators: assess cleaning compliance risk across OSHA, HIPAA, CMS, AAAHC, and NYS rules in minutes.',
    alternates: {
        canonical: 'https://xiri.ai/tools/compliance-checker',
    },
    openGraph: {
        title: 'Compliance Readiness Checker for Facility Managers',
        description: 'Assess facility-level cleaning compliance risk and identify gaps before inspections, citations, or operational disruption.',
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
