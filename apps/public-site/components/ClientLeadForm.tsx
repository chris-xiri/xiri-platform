"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { isValidZip } from "@/data/validZips";

interface ClientLeadFormProps {
    industryName?: string;
    prefilledService?: string;
    className?: string;
    onStart?: () => void; // Callback when user starts the audit
}

export function ClientLeadForm({ industryName, prefilledService, className, onStart }: ClientLeadFormProps) {
    const router = useRouter();
    const [zip, setZip] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Basic Length Check
        if (zip.length !== 5) {
            setError("Please enter a valid 5-digit Zip Code.");
            return;
        }

        setLoading(true);

        // Open to all Zips (Nationwide)
        // Valid -> Start Audit Flow
        const params = new URLSearchParams({
            zip,
            service: prefilledService || "general",
            source: "homepage_lead_form"
        });

        if (onStart) onStart();

        router.push(`/audit/start?${params.toString()}`);
    };

    return (
        <div id="audit" className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-8 ${className || ''}`}>
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {industryName ? `Get Your ${industryName} Audit` : "Check Availability"}
                </h3>
                <p className="text-gray-600">
                    See if XIRI is available for your facility.
                </p>
            </div>

            <form onSubmit={handleStart} className="space-y-4">
                <div>
                    <label htmlFor="zip" className="sr-only">Zip Code</label>
                    <div className="relative">
                        <input
                            type="text"
                            id="zip"
                            value={zip}
                            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            placeholder="Enter Facility Zip Code"
                            className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-gray-400 font-bold text-lg text-gray-900 tracking-wider"
                            maxLength={5}
                            required
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-red-500 text-sm font-medium animate-pulse">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading || zip.length < 5}
                    className="w-full bg-sky-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-600/30 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Checking Coverage...
                        </>
                    ) : (
                        <>
                            Start Free Audit
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>

            <p className="text-xs text-center text-gray-400 mt-4">
                No commitment required. 100% Free Audit.
            </p>
        </div>
    );
}
