import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Free Cleaning Chemical SDS Lookup — 50+ Chemicals, VOC & PPE Data | XIRI',
    description: 'Search 50+ cleaning chemicals with Safety Data Sheets, VOC compliance, PPE requirements, EPA List N status, and Green Seal certifications. Filter by category, regulatory status, and EPA Safer Choice. Free — no signup required.',
    alternates: {
        canonical: 'https://xiri.ai/tools/sds-lookup',
    },
    openGraph: {
        title: 'Cleaning Chemical SDS Lookup',
        description: 'Free searchable database of common janitorial chemicals with VOC compliance, PPE, and regulatory notes.',
        url: 'https://xiri.ai/tools/sds-lookup',
        siteName: 'XIRI Facility Solutions',
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
