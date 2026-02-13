'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/tracking';

const FACILITY_OPTIONS = [
    { id: 'medical', label: 'Medical / Dental', icon: '🏥' },
    { id: 'auto', label: 'Auto Dealership', icon: '🚘' },
    { id: 'education', label: 'Education / Daycare', icon: '🎓' },
    { id: 'commercial', label: 'Office / Commercial', icon: '🏢' },
];

export function LeadForm({ industryName }: { industryName?: string }) {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [selectedFacility, setSelectedFacility] = useState<string>(industryName ? '' : '');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus('submitting');

        // Simulate submission for now
        setTimeout(() => {
            setStatus('success');
            trackEvent('lead_submission_success', {
                form_name: 'facility_audit',
                industry: industryName || selectedFacility
            });
        }, 1500);
    };

    if (status === 'success') {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-sky-500 animate-fade-in">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                    ✓
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Audit Request Received!</h3>
                <p className="text-gray-600 mb-6">
                    We've started your file. Your local Facility Solutions Manager will reach out shortly to schedule your compliance walkthrough.
                </p>
                <div className="text-sm text-gray-400">
                    Reference ID: #{Math.floor(Math.random() * 10000)}
                </div>
            </div>
        );
    }

    return (
        <div id="audit" className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="bg-sky-50 px-8 py-6 border-b border-sky-100">
                <h3 className="text-xl font-bold font-heading text-sky-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 bg-sky-100 rounded-lg text-lg">📄</span>
                    {industryName ? `Audit Request: ${industryName}` : 'Request Facility Audit'}
                </h3>
                <p className="text-sm text-sky-700 mt-1 pl-10">
                    Get a free compliance assessment & custom proposal.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-grow flex flex-col">

                {/* Generic Mode: Facility Type Selector */}
                {!industryName && (
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-900">Type of Facility</label>
                        <div className="grid grid-cols-2 gap-3">
                            {FACILITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSelectedFacility(opt.label)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition-all ${selectedFacility === opt.label
                                            ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-sm ring-1 ring-sky-500'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-sky-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label htmlFor="companyName" className="sr-only">Company Name</label>
                        <input
                            type="text"
                            id="companyName"
                            required
                            className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                            placeholder="Company / Facility Name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="contactName" className="sr-only">Contact Name</label>
                            <input
                                type="text"
                                id="contactName"
                                required
                                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                                placeholder="Contact Name"
                            />
                        </div>
                        <div>
                            <label htmlFor="phone" className="sr-only">Phone</label>
                            <input
                                type="tel"
                                id="phone"
                                required
                                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                                placeholder="Phone Number"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="sr-only">Email</label>
                        <input
                            type="email"
                            id="email"
                            required
                            className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                            placeholder="Email Address"
                        />
                    </div>
                </div>

                {/* Trust Footer */}
                <div className="mt-auto pt-6">
                    <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="w-full bg-sky-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-700 transition-all shadow-xl shadow-sky-600/20 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {status === 'submitting' ? (
                            <>Processing...</>
                        ) : (
                            <>
                                Get My Free Audit
                                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-4">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
                        <span>Your data is 256-bit Encrypted & HIPAA Compliant.</span>
                    </div>
                </div>
            </form>
        </div>
    );
}
