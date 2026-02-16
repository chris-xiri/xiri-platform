"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

function OnboardingInitializer() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const initVendor = async () => {
            try {
                // Extract params
                const trade = searchParams.get("trade");
                const zone = searchParams.get("zone");
                const source = searchParams.get("source") || "direct";
                const market = searchParams.get("market");
                const lang = searchParams.get("lang") || "en";

                // Create Vendor with Context
                const docRef = await addDoc(collection(db, "vendors"), {
                    status: 'new',
                    source: source,
                    preferredLanguage: lang,

                    // Pre-fill fields from pSEO context
                    specialty: trade, // e.g. "janitorial"
                    location: zone,   // e.g. "nassau"

                    // Metadata for attribution
                    attribution: {
                        marketSlug: market,
                        campaign: source
                    },

                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    onboarding: {
                        status: 'started',
                        currentStep: '0'
                    }
                });

                // Redirect to actual onboarding form
                router.replace(`/onboarding/${docRef.id}`);

            } catch (err) {
                console.error("Failed to initialize vendor:", err);
                // Fallback to home on error
                router.replace("/");
            }
        };

        initVendor();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Initializing application...</p>
            <p className="text-slate-400 text-sm mt-2">Setting up your profile</p>
        </div>
    );
}

export default function StartOnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <OnboardingInitializer />
        </Suspense>
    );
}
