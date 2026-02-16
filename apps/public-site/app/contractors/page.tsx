import { VendorLeadForm } from '@/components/VendorLeadForm';
import { ContractorValueProps } from '@/components/ContractorValueProps';
import { ContractorHero } from '@/components/ContractorHero';
import { Search, DollarSign } from 'lucide-react';

export const metadata = {
    title: 'Join the XIRI Contractor Network | Consistent Facility Jobs',
    description: 'Get consistent facility management jobs without the sales headaches. Join XIRI\'s vetted contractor network today.',
};

export default function ContractorsPage() {

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* HERO SECTION - darker theme for distinction */}
            <div>
                <ContractorHero />
            </div>

            {/* VALUE PROPS (TABBED) */}
            <ContractorValueProps />

            {/* HOW IT WORKS */}
            <section className="py-20 bg-white border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4 tracking-tight">How It Works</h2>
                        <p className="text-lg text-gray-600">Simple steps to start getting job assignments.</p>
                    </div>

                    <div className="relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-100 -z-10"></div>

                        <div className="grid md:grid-cols-4 gap-8">
                            <div className="bg-white pt-4 text-center group">
                                <div className="w-16 h-16 bg-white text-sky-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold border-4 border-slate-100 shadow-sm group-hover:border-sky-100 group-hover:bg-sky-50 transition-all">1</div>
                                <h4 className="text-lg font-bold text-gray-900 mb-2">Apply</h4>
                                <p className="text-sm text-gray-600 px-4">Submit your company details and service capabilities.</p>
                            </div>
                            <div className="bg-white pt-4 text-center group">
                                <div className="w-16 h-16 bg-white text-sky-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold border-4 border-slate-100 shadow-sm group-hover:border-sky-100 group-hover:bg-sky-50 transition-all">2</div>
                                <h4 className="text-lg font-bold text-gray-900 mb-2">Get Verified</h4>
                                <p className="text-sm text-gray-600 px-4">Upload insurance and compliance docs for review.</p>
                            </div>
                            <div className="bg-white pt-4 text-center group">
                                <div className="w-16 h-16 bg-white text-sky-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold border-4 border-slate-100 shadow-sm group-hover:border-sky-100 group-hover:bg-sky-50 transition-all">3</div>
                                <h4 className="text-lg font-bold text-gray-900 mb-2">Start Working</h4>
                                <p className="text-sm text-gray-600 px-4">Receive job assignments in your designated territory.</p>
                            </div>
                            <div className="bg-white pt-4 text-center group">
                                <div className="w-16 h-16 bg-white text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold border-4 border-slate-100 shadow-sm group-hover:border-green-100 group-hover:bg-green-50 transition-all">4</div>
                                <h4 className="text-lg font-bold text-gray-900 mb-2">Get Paid</h4>
                                <p className="text-sm text-gray-600 px-4">Reliable payments for all completed work.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* REQUIREMENTS & FORM SPLIT */}
            <section className="py-24 bg-slate-900 text-white" id="apply-form">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-start">
                        {/* Requirements Column */}
                        <div className="space-y-8 lg:sticky lg:top-24">
                            <div>
                                <h2 className="text-3xl font-heading font-bold text-white mb-6">Requirements to Join</h2>
                                <p className="text-lg text-slate-300 mb-8">
                                    We maintain high standards for our clients. All partners must meet the following criteria:
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-sky-900/50 rounded-lg">
                                        <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4 8 4v14M13 10v4" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">Registered Business Entity</h4>
                                        <p className="text-slate-400 text-sm mt-1">Must be an LLC, Corporation, or formal business entity.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-sky-900/50 rounded-lg">
                                        <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">General Liability Insurance</h4>
                                        <p className="text-slate-400 text-sm mt-1">$1 Million minimum coverage required.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-sky-900/50 rounded-lg">
                                        <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">Workers' Compensation</h4>
                                        <p className="text-slate-400 text-sm mt-1">Required where applicable by law.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-sky-900/50 rounded-lg">
                                        <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">Licensed & Bonded</h4>
                                        <p className="text-slate-400 text-sm mt-1">Must hold valid licenses for your trade.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-sky-900/50 rounded-lg">
                                        <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">Reliable Scheduling</h4>
                                        <p className="text-slate-400 text-sm mt-1">Must be able to commit to consistent service windows.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 mt-8">
                                <h4 className="font-bold text-sky-400 mb-4">Looking for local partners in:</h4>
                                <div className="flex flex-wrap gap-2 text-sm">
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">Janitorial</span>
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">HVAC</span>
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">Landscaping</span>
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">Electrical</span>
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">Plumbing</span>
                                    <span className="bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-600">General Maintenance</span>
                                </div>
                            </div>
                        </div>

                        {/* Form Column */}
                        <div className="lg:pl-8 text-left">
                            <VendorLeadForm />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-heading font-bold text-center text-gray-900 mb-12 tracking-tight">Frequently Asked Questions</h2>

                    <div className="space-y-6">
                        <details className="group bg-slate-50 rounded-xl p-6 [&_summary::-webkit-details-marker]:hidden border border-slate-100">
                            <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-gray-900">
                                <h3 className="text-lg">How quickly can I start receiving jobs?</h3>
                                <svg className="h-5 w-5 shrink-0 transition duration-300 group-open:-rotate-180 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="mt-4 leading-relaxed text-gray-700 border-t border-gray-200 pt-4">
                                Once your documents are verified (usually 24-48 hours), you are eligible for assignment. Actual job offers depend on client demand in your service area.
                            </p>
                        </details>

                        <details className="group bg-slate-50 rounded-xl p-6 [&_summary::-webkit-details-marker]:hidden border border-slate-100">
                            <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-gray-900">
                                <h3 className="text-lg">Does XIRI take a commission?</h3>
                                <svg className="h-5 w-5 shrink-0 transition duration-300 group-open:-rotate-180 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="mt-4 leading-relaxed text-gray-700 border-t border-gray-200 pt-4">
                                No. We are not a lead generation service. We are the facility manager. We pay you the agreed-upon rate for the service. Our management fee is charged to the client, not you.
                            </p>
                        </details>

                        <details className="group bg-slate-50 rounded-xl p-6 [&_summary::-webkit-details-marker]:hidden border border-slate-100">
                            <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-gray-900">
                                <h3 className="text-lg">Can I keep my own clients?</h3>
                                <svg className="h-5 w-5 shrink-0 transition duration-300 group-open:-rotate-180 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="mt-4 leading-relaxed text-gray-700 border-t border-gray-200 pt-4">
                                Absolutely. XIRI is just another customer for your business—hopefully your best one. You continue to run your business as usual; we just add volume to your schedule.
                            </p>
                        </details>

                        <details className="group bg-slate-50 rounded-xl p-6 [&_summary::-webkit-details-marker]:hidden border border-slate-100">
                            <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-gray-900">
                                <h3 className="text-lg">How do payments work?</h3>
                                <svg className="h-5 w-5 shrink-0 transition duration-300 group-open:-rotate-180 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="mt-4 leading-relaxed text-gray-700 border-t border-gray-200 pt-4">
                                We provide net-30 payment terms for all verified work. You submit one invoice to XIRI for all jobs completed in the billing cycle, and we issue one consolidated payment.
                            </p>
                        </details>
                    </div>
                </div>
            </section>
        </div>
    );
}
