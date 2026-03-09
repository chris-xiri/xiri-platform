import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Free Cleaning Chemical SDS Lookup — VOC, PPE, Regulation Notes | XIRI',
    description: 'Look up Safety Data Sheets, VOC compliance, PPE requirements, and regulation notes for common janitorial and healthcare cleaning chemicals. Filter by Green Seal, NYS Part 226 VOC compliance, and category.',
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
