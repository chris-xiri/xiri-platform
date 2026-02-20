import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pay Invoice — Xiri Facility Solutions',
    description: 'View and pay your facility services invoice securely.',
};

export default function InvoicePayLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-sky-50/30">
            {children}
        </div>
    );
}
