"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { trackEvent, getFirstTouchAttribution } from "@/lib/tracking";

function AuditInitializer() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
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

                // Create Lead with full first-touch & AI / pSEO attribution
                const docRef = await addDoc(collection(db, "leads"), {
                    status: 'new',
                    zipCode: zip || null,
                    email: email || null,
                    serviceInterest: service,
                    facilityType: facilityType || null,
                    businessName: businessName || null,
                    address: address || null,
                    squareFootage: squareFootage ? Number(squareFootage) : null,
                    serviceWindow: serviceWindow || null,
                    transitionDate: transitionDate || null,
                    scopeBrief: scopeBrief || null,
                    attribution: {
                        source: firstTouch?.aiSource ? `ai_${firstTouch.aiSource}` : source,
                        formSource: source,
                        medium: firstTouch?.utmMedium || (firstTouch?.aiSource ? 'ai_answer_engine' : 'web_audit_flow'),
                        campaign: firstTouch?.utmCampaign || 'seo_geo_2026',
                        landingPage: firstTouch?.initialLandingPage || originPage || window.location.pathname,
                        conversionPage: originPage || window.location.pathname,
                        referrer: firstTouch?.initialReferrer || document.referrer || 'direct',
                        aiEngine: firstTouch?.aiSource || null,
                    },
                    createdAt: serverTimestamp(),
                    // Wizard State
                    wizardStep: 1
                });

                // Redirect to Wizard (same as vendor onboarding pattern)
                trackEvent('audit_start', {
                    zip: zip || '',
                    service,
                    source,
                    origin_page: originPage || '',
                    ai_engine: firstTouch?.aiSource || 'none',
                });
                router.replace(`/audit/${docRef.id}`);

            } catch (err) {
                const error = err as any;
                console.error("Failed to initialize lead:", error);
                router.replace("/");
            }
        };

        initLead();
    }, [router, searchParams]);

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
