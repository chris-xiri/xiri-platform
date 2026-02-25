"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Hero } from "./Hero";
import { Loader2, Search, DollarSign } from "lucide-react";

interface ContractorHeroProps {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaLink?: string;
    imageSrc?: string;
}

export function ContractorHero({
    headline,
    subheadline,
    ctaText,
    ctaLink,
    imageSrc
}: ContractorHeroProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        // If a direct link is provided (e.g. for pSEO), use it
        if (ctaLink) {
            router.push(ctaLink);
            return;
        }

        setLoading(true);

        try {
            // Create a blank Vendor Record to initialize the onboarding flow
            const docRef = await addDoc(collection(db, "vendors"), {
                status: 'new',
                source: 'web_contractors_lpage_hero',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                onboarding: {
                    status: 'started',
                    currentStep: '0' // Starts at Language Selection
                }
            });

            router.push(`/onboarding/${docRef.id}`);

        } catch (err: any) {
            console.error("Error creating vendor:", err);
            setLoading(false);
        }
    };

    const features = [
        { text: "No Sales Required", icon: <Search className="w-5 h-5 text-sky-400" /> },
        { text: "On-Time Payments", icon: <DollarSign className="w-5 h-5 text-sky-400" /> }
    ];

    const defaultHeadline = (
        <span className="text-white">Focus on the Work.<br /><span className="text-sky-400">We'll Handle the Rest.</span></span>
    );

    const defaultSubheadline = (
        <span className="text-slate-300">We have active facility contracts that need crews. See what's available in your area — no commitment to start.</span>
    );

    return (
        <Hero
            title={headline ? <span className="text-white" dangerouslySetInnerHTML={{ __html: headline.replace(/\n/g, "<br/>") }} /> : defaultHeadline}
            subtitle={subheadline ? <span className="text-slate-300">{subheadline}</span> : defaultSubheadline}
            ctaText={loading ? "Loading..." : (ctaText || "See Available Jobs")}
            onCtaClick={handleStart}
            industryIcon="🛠️"
            industryLabel="Verified Service Partner"
            features={features}
            showSecondaryBtn={false}
            variant="dark"
            backgroundImage={imageSrc}
        />
    );
}
