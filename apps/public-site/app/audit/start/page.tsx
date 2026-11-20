"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Loader2, AlertCircle } from "lucide-react";
import { trackEvent, getFirstTouchAttribution } from "@/lib/tracking";

function AuditInitializer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const startedRef = useRef(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const initLead = async () => {
            try {
                // Extract params
                const zip = searchParams.get("zip");
                const email = searchParams.get("email");
                const service = searchParams.get("service") || "general";
                const source = searchParams.get("source") || "direct";
                const facilityType = searchParams.get("facilityType") || "";
                const businessName = searchParams.get("businessName") || "";
                const address = searchParams.get("address") || "";
                const squareFootage = searchParams.get("squareFootage") || "";
                const serviceWindow = searchParams.get("serviceWindow") || "";
                const transitionDate = searchParams.get("transitionDate") || "";
                const scopeBrief = searchParams.get("scopeBrief") || "";
                const originPage = searchParams.get("originPage") || "";
                const firstTouch = getFirstTouchAttribution();

                if (!zip && !address) {
                    router.replace("/");
                    return;
                }

                // Create Lead via Admin SDK Cloud Function (keeps `leads` / `companies` locked down in Firestore rules)
                const createAuditLeadFn = httpsCallable<Record<string, any>, { leadId: string }>(
                    functions,
                    "createAuditLead"
                );
                const result = await createAuditLeadFn({
                    zip: zip || "",
                    email: email || "",
                    service,
                    source,
                    facilityType,
                    businessName,
                    address,
                    squareFootage: squareFootage ? Number(squareFootage) : null,
                    serviceWindow,
                    transitionDate,
                    scopeBrief,
                    originPage,
                    attribution: {
                        source: firstTouch?.aiSource ? `ai_${firstTouch.aiSource}` : source,
                        formSource: source,
                        medium: firstTouch?.utmMedium || (firstTouch?.aiSource ? "ai_answer_engine" : "web_audit_flow"),
                        campaign: firstTouch?.utmCampaign || "seo_geo_2026",
                        landingPage: firstTouch?.initialLandingPage || originPage || window.location.pathname,
                        conversionPage: originPage || window.location.pathname,
                        referrer: firstTouch?.initialReferrer || document.referrer || "direct",
                        aiEngine: firstTouch?.aiSource || null,
                    },
                });

                const leadId = result.data?.leadId;
                if (!leadId) {
                    throw new Error("Missing leadId from createAuditLead");
                }

                trackEvent("audit_start", {
                    zip: zip || "",
                    service,
                    source,
                    origin_page: originPage || "",
                    ai_engine: firstTouch?.aiSource || "none",
                });
                router.replace(`/audit/${leadId}`);
            } catch (err) {
                console.error("Failed to initialize audit lead:", err);
                setError("We couldn't start your audit right now. Please try again or call us at (516) 399-0350.");
            }
        };

        void initLead();
    }, [router, searchParams]);

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Unable to Start Audit</h1>
                    <p className="text-sm text-slate-600">{error}</p>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace("/")}
                            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Return Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Starting your Free Audit...</p>
            <p className="text-slate-400 text-sm mt-2">Setting up secure file</p>
        </div>
    );
}

export default function AuditStartPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <AuditInitializer />
        </Suspense>
    );
}
