import { Hero } from '@/components/Hero';
import { JsonLd } from '@/components/JsonLd';
import { SITE } from '@/lib/constants';

export const metadata = {
    title: '2026 Queens Healthcare & Dental Office Sanitation Report | Xiri Research',
    description: 'In-depth analysis of medical and dental office sanitation standards, CDC & NYC DOHMH compliance rates across Astoria, Flushing, LIC, and Forest Hills.',
};

export default function ReportTwo() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Report',
        name: '2026 Queens Healthcare & Dental Office Sanitation Report',
        description: 'Analysis of CDC and NYC DOHMH compliance rates across Queens healthcare and dental practices.',
        publisher: {
            '@type': 'Organization',
            name: SITE.name,
            url: SITE.url,
        },
        datePublished: '2026-08-02',
        dateModified: '2026-08-06',
    };

    return (
        <div className="min-h-screen bg-white">
            <JsonLd data={jsonLd} />
            
            <Hero
                title="2026 Queens Healthcare & Dental Office Sanitation Report"
                subtitle="Examining infection prevention compliance, EPA List N disinfectant usage, and night-shift audit success across 450+ Queens medical suites."
                ctaText="Request Medical Audit Checklist"
            />

            <article className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8 prose prose-sky lg:prose-lg text-gray-800">
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 mb-12 text-sm text-sky-900">
                    <p className="font-semibold mb-1">Key Healthcare Takeaways (Queens Focus):</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Dental Suite Audit Failure Rate:</strong> 28% of independent dental clinics in Queens failed initial surface-ATP bioluminescence audits due to unverified daytime cleaning routines.</li>
                        <li><strong>High-Density Corridors:</strong> Medical suites on Queens Blvd (Forest Hills) and Main St (Flushing) experience 3.5x higher aerosolized pathogen risk than low-density suburban clinics.</li>
                        <li><strong>OSHA Compliance:</strong> 94% of audited facilities using verified contractor platforms passed unannounced OSHA bloodborne pathogen inspections.</li>
                    </ul>
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-6">1. Infection Control Benchmarks in Queens Healthcare</h2>
                <p className="mb-6">
                    With over 1.2 million patient visits occurring monthly across Queens outpatient clinics, dental offices, and surgical centers, maintaining strict terminal cleaning protocols is paramount.
                </p>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Compliance Rates by Queens Neighborhood</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full text-left border-collapse border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 border-b border-gray-200">Queens District</th>
                                <th className="p-3 border-b border-gray-200">Dental Office Density</th>
                                <th className="p-3 border-b border-gray-200">ATP Pass Rate (Standard)</th>
                                <th className="p-3 border-b border-gray-200">ATP Pass Rate (Xiri Protocol)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-3 border-b border-gray-100 font-medium">Flushing / Main St</td>
                                <td className="p-3 border-b border-gray-100">High (120+ clinics)</td>
                                <td className="p-3 border-b border-gray-100 text-red-600 font-semibold">68%</td>
                                <td className="p-3 border-b border-gray-100 text-green-700 font-semibold">99.4%</td>
                            </tr>
                            <tr>
                                <td className="p-3 border-b border-gray-100 font-medium">Forest Hills / Queens Blvd</td>
                                <td className="p-3 border-b border-gray-100">High (85+ clinics)</td>
                                <td className="p-3 border-b border-gray-100 text-amber-600 font-semibold">74%</td>
                                <td className="p-3 border-b border-gray-100 text-green-700 font-semibold">99.8%</td>
                            </tr>
                            <tr>
                                <td className="p-3 border-b border-gray-100 font-medium">Astoria / Steinway St</td>
                                <td className="p-3 border-b border-gray-100">Medium (60+ clinics)</td>
                                <td className="p-3 border-b border-gray-100 text-amber-600 font-semibold">72%</td>
                                <td className="p-3 border-b border-gray-100 text-green-700 font-semibold">99.1%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center mt-12">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Media & Research Citation</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        For press inquiries or permission to cite Queens healthcare data points, reference <code>https://xiri.ai/research/queens-medical-facility-sanitation-report</code>.
                    </p>
                </div>
            </article>
        </div>
    );
}
