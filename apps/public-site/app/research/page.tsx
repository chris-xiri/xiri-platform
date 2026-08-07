import Link from 'next/link';
import { Hero } from '@/components/Hero';

export const metadata = {
    title: 'Commercial Cleaning Research & Industry Reports 2026 | Xiri Research',
    description: 'Explore data-driven research reports, wage benchmarks, and commercial facility sanitation standards for New York, Queens, Nassau, and Suffolk counties.',
};

const REPORTS = [
    {
        slug: 'ny-commercial-sanitation-index',
        title: '2026 NY Commercial Facility Sanitation & Wage Benchmark Report',
        description: 'Comprehensive analysis of prevailing janitorial wage rates, compliance standards, and commercial facility operating costs across the New York metro area.',
        date: 'Updated August 2026',
        category: 'Industry Benchmark',
        readTime: '8 min read',
    },
    {
        slug: 'queens-medical-facility-sanitation-report',
        title: '2026 Queens Healthcare & Dental Office Sanitation Report',
        description: 'Examining CDC & DOHMH compliance, infection prevention protocols, and specialized cleaning standards across Queens medical and dental practices.',
        date: 'Updated August 2026',
        category: 'Healthcare & Dental',
        readTime: '6 min read',
    },
    {
        slug: 'long-island-industrial-cleaning-report',
        title: '2026 Long Island Commercial & Industrial Facility Cost Analysis',
        description: 'Data-backed breakdown of maintenance costs per sq. ft., OSHA compliance rates, and vendor management trends across Nassau & Suffolk County industrial parks.',
        date: 'Updated August 2026',
        category: 'Industrial & Corporate',
        readTime: '7 min read',
    },
];

export default function ResearchHub() {
    return (
        <div className="min-h-screen bg-white">
            <Hero
                title="Xiri Facility Intelligence & Industry Research"
                subtitle="Data-driven reports, economic benchmarks, and facility management studies designed to empower New York business owners, healthcare administrators, and property managers."
                ctaText="Get Custom Facility Insights"
            />

            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <div className="mb-12 text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Latest Research Publications</h2>
                    <p className="text-gray-600">
                        Our research team synthesizes data from the Bureau of Labor Statistics (BLS), U.S. Census Bureau, OSHA, CDC, and proprietary Xiri network audits.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {REPORTS.map((report) => (
                        <Link 
                            key={report.slug}
                            href={`/research/${report.slug}`}
                            className="flex flex-col bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-xl hover:border-sky-300 transition-all group"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full">
                                    {report.category}
                                </span>
                                <span className="text-xs text-gray-400">{report.readTime}</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors mb-3">
                                {report.title}
                            </h3>
                            <p className="text-gray-600 text-sm mb-6 flex-grow">
                                {report.description}
                            </p>
                            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm font-semibold text-sky-600">
                                <span>Read Full Report →</span>
                                <span className="text-xs font-normal text-gray-400">{report.date}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bg-sky-900 text-white py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold mb-4">Need Custom Market Data or Media Inquiries?</h2>
                    <p className="text-sky-200 mb-8">
                        Our data team provides custom facility cost analyses and expert commentary for journalists, commercial real estate brokers, and facility directors.
                    </p>
                    <a 
                        href="mailto:press@xiri.ai" 
                        className="inline-block bg-white text-sky-900 font-bold px-8 py-4 rounded-xl hover:bg-sky-50 transition-colors"
                    >
                        Contact Research Team
                    </a>
                </div>
            </div>
        </div>
    );
}
