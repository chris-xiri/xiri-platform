import { Metadata } from 'next';
import Link from 'next/link';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import RfpBidAnalyzerTool from '@/components/RfpBidAnalyzerTool';

export const metadata: Metadata = {
    title: 'Janitorial RFP Builder Tool | XIRI',
    description: 'For facility managers and owners: generate a janitorial RFP from a brief and share a clean, professional scope document with vendors.',
    keywords: [
        'janitorial rfp template',
        'janitorial rfp builder',
        'cleaning company takeover checklist',
        'facility manager janitorial bids',
        'commercial cleaning rfp',
    ],
    alternates: {
        canonical: 'https://xiri.ai/tools/janitorial-rfp',
    },
};

export default function JanitorialRfpBidAnalyzerPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <AuthorityBreadcrumb items={[{ label: 'Tools', href: '/tools' }, { label: 'Janitorial RFP Builder' }]} />

            <section className="bg-slate-900 text-white py-16">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-sm font-bold tracking-widest uppercase text-sky-300 mb-3">Free Tool</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Janitorial RFP Builder</h1>
                    <p className="text-xl text-slate-300 max-w-3xl">
                        Start from a simple scope brief. Generate a polished RFP from your scope brief, then copy, download, or email it for vendor quoting.
                    </p>
                    <p className="text-sm text-slate-400 mt-4">
                        Contractors and subcontractors should use{' '}
                        <Link href="/contractors" className="underline hover:text-slate-200">contractor onboarding</Link>.
                    </p>
                </div>
            </section>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <RfpBidAnalyzerTool />
            </main>
        </div>
    );
}
