"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Loader2, ArrowRight, CheckCircle } from "lucide-react";

export function VendorLeadForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleStart = async () => {
        setLoading(true);

        try {
            // Updated Flow: Redirect to the Central "Traffic Controller"
            // This ensures consistent attribution whether coming from pSEO or homepage
            router.push("/onboarding/start?source=web_contractors_lpage_direct");

        } catch (err: any) {
            console.error("Error redirecting:", err);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-sky-50 p-8 rounded-2xl shadow-xl border border-sky-100 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-sky-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starting Application...</h3>
                <p className="text-gray-600 mb-8">
                    Redirecting you to the secure portal.
                </p>
                <Loader2 className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-full flex flex-col justify-center min-h-[400px]" id="apply-form">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-100 rounded-full mb-6">
                    <ArrowRight className="w-8 h-8 text-sky-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Start Your Application</h3>
                <p className="text-lg text-gray-600 max-w-sm mx-auto">
                    Complete our verified partner onboarding process. It typically takes less than 5 minutes.
                </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto w-full">
                <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full bg-sky-600 text-white font-bold py-5 rounded-xl hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-600/30 flex items-center justify-center gap-3 text-lg group"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Initializing...
                        </>
                    ) : (
                        <>
                            Get Started
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                <p className="text-xs text-center text-gray-400">
                    By clicking Get Started, you agree to our Terms of Service.
                </p>
            </div>
        </div>
    );
}
