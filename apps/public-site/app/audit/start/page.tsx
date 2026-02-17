"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

function AuditInitializer() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const initLead = async () => {
            try {
                // Extract params
                const zip = searchParams.get("zip");
                const service = searchParams.get("service") || "general";
                const source = searchParams.get("source") || "direct";

                if (!zip) {
                    router.replace("/");
                    return;
                }

                // Create Lead
                const docRef = await addDoc(collection(db, "leads"), {
                    status: 'new',
                    zipCode: zip,
                    serviceInterest: service,
                    attribution: {
                        source,
                        medium: 'web_audit_flow',
                        campaign: 'alpha_launch',
                        landingPage: window.location.pathname
                    },
                    createdAt: serverTimestamp(),
                    // Wizard State
                    wizardStep: 1
                });

                // Redirect to Wizard (same as vendor onboarding pattern)
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
