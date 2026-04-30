import { Metadata } from 'next';
import { SITE } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'SDS & Chemical Risk Lookup for Facility Managers | XIRI',
    description: 'Free SDS and chemical compliance lookup for facility managers and building operators. Review VOC, PPE, and regulatory risk indicators before approving cleaning products.',
    alternates: {
        canonical: 'https://xiri.ai/tools/sds-lookup',
    },
    openGraph: {
        title: 'SDS Lookup for Building Operations Teams',
        description: 'Evaluate cleaning chemical risk, compliance flags, and documentation needs for your facility program.',
        url: 'https://xiri.ai/tools/sds-lookup',
        siteName: SITE.name,
        type: 'website',
    },
};

export default function SDSLookupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
