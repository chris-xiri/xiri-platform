'use client';

import { useState, useEffect, useCallback } from 'react';
import CampaignLauncher from "@/components/CampaignLauncher";
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RecruitmentDetailView from "@/components/supply/RecruitmentDetailView";
import CampaignResultsTable from "@/components/supply/CampaignResultsTable";
import { cn } from "@/lib/utils";
import { Vendor } from "@xiri/shared";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function RecruitmentPage() {
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [campaignResults, setCampaignResults] = useState<Vendor[]>([]);
    const [campaignMeta, setCampaignMeta] = useState<{ query: string; location: string; sourced: number; qualified: number } | undefined>();

    // Toggle Selection (Clicking active row or background closes it)
    const handleSelectVendor = (id: string | null) => {
        if (id === null) {
            setSelectedVendorId(null);
            return;
        }
        setSelectedVendorId(prev => prev === id ? null : id);
    };

    // Close on Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedVendorId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle campaign results from CampaignLauncher
    const handleCampaignResults = useCallback((vendors: Vendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => {
        // Append to existing results (don't replace in case of multiple campaigns)
        setCampaignResults(prev => [...prev, ...vendors]);
        setCampaignMeta(meta);
    }, []);

    // Approve a vendor — save to Firestore vendors collection
    const handleApprove = useCallback(async (vendorId: string) => {
        const vendor = campaignResults.find(v => v.id === vendorId);
        if (!vendor) return;

        try {
            // Save to Firestore vendors collection
            const { id, ...vendorData } = vendor;
            await addDoc(collection(db, "vendors"), {
                ...vendorData,
                status: 'pending_review',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                source: 'campaign_approved'
            });

            // Remove from preview state
            setCampaignResults(prev => prev.filter(v => v.id !== vendorId));
            console.log(`✅ Vendor "${vendor.businessName}" approved and saved to CRM.`);
        } catch (error) {
            console.error("Error approving vendor:", error);
        }
    }, [campaignResults]);

    // Dismiss a vendor — remove from preview state
    const handleDismiss = useCallback((vendorId: string) => {
        setCampaignResults(prev => prev.filter(v => v.id !== vendorId));
    }, []);

    // Approve all vendors
    const handleApproveAll = useCallback(async () => {
        for (const vendor of campaignResults) {
            const { id, ...vendorData } = vendor;
            try {
                await addDoc(collection(db, "vendors"), {
                    ...vendorData,
                    status: 'pending_review',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    source: 'campaign_approved'
                });
            } catch (error) {
                console.error(`Error approving vendor "${vendor.businessName}":`, error);
            }
        }
        setCampaignResults([]);
        console.log(`✅ All ${campaignResults.length} vendors approved and saved to CRM.`);
    }, [campaignResults]);

    // Dismiss all vendors
    const handleDismissAll = useCallback(() => {
        setCampaignResults([]);
        setCampaignMeta(undefined);
    }, []);

    return (
        <ProtectedRoute resource="supply/recruitment">
            <div className="min-h-screen bg-background transition-colors duration-300 overflow-hidden">
                {/* Main Content */}
                <main className="w-full h-[calc(100vh-64px)] flex">
                    {/* LEFT PANEL: List View */}
                    <div
                        className={cn(
                            "flex flex-col h-full transition-all duration-300 ease-in-out border-r border-border",
                            selectedVendorId ? "w-1/3 min-w-[400px]" : "w-full"
                        )}
                        onClick={() => handleSelectVendor(null)} // Click whitespace to close
                    >
                        <div className="p-2 pb-0" onClick={(e) => e.stopPropagation()}>
                            {/* Stop propagation for header controls */}
                            <CampaignLauncher onResults={handleCampaignResults} />

                            {/* Campaign Preview Results (in-memory, not saved yet) */}
                            <CampaignResultsTable
                                vendors={campaignResults}
                                campaignMeta={campaignMeta}
                                onApprove={handleApprove}
                                onDismiss={handleDismiss}
                                onApproveAll={handleApproveAll}
                                onDismissAll={handleDismissAll}
                            />
                        </div>
                        <div className="flex-1 overflow-hidden px-2 py-4">
                            <VendorList
                                title="Recruitment Pipeline"
                                isRecruitmentMode={true}
                                onSelectVendor={handleSelectVendor}
                                selectedVendorId={selectedVendorId}
                            />
                        </div>
                    </div>

                    {/* RIGHT PANEL: Detail View (Split Screen) */}
                    {selectedVendorId && (
                        <div className="flex-1 h-full bg-background animate-in slide-in-from-right-10 duration-200">
                            <RecruitmentDetailView
                                vendorId={selectedVendorId}
                                onClose={() => handleSelectVendor(null)}
                            />
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}

