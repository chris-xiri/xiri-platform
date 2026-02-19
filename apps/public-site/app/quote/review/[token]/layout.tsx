import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Review Your Service Proposal — XIRI Facility Solutions',
    description: 'Review and respond to your facility services proposal from XIRI Facility Solutions.',
    robots: { index: false, follow: false },
};

export default function QuoteReviewLayout({ children }: { children: React.ReactNode }) {
    return children;
}
