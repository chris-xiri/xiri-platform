'use client';

import { useState, useEffect, useCallback } from 'react';
import CampaignLauncher from "@/components/CampaignLauncher";
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RecruitmentDetailView from "@/components/supply/RecruitmentDetailView";
import CampaignResultsTable, { Campaign } from "@/components/supply/CampaignResultsTable";
import { cn } from "@/lib/utils";
import { Vendor } from "@xiri/shared";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Generate a simple unique ID for campaigns
const generateId = () => `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// Helper: write vendor to dismissed_vendors collection
const dismissVendorInFirestore = async (vendor: Vendor, campaignQuery?: string, campaignLocation?: string) => {
    try {
        await addDoc(collection(db, "dismissed_vendors"), {
            businessName: vendor.businessName,
            dismissedAt: serverTimestamp(),
            campaignQuery: campaignQuery || null,
            campaignLocation: campaignLocation || null,
        });
    } catch (err) {
        console.error(`Failed to persist dismissal for "${vendor.businessName}":`, err);
    }
};

export default function RecruitmentPage() {
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

    // Toggle Selection
    const handleSelectVendor = (id: string | null) => {
        if (id === null) { setSelectedVendorId(null); return; }
        setSelectedVendorId(prev => prev === id ? null : id);
    };

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedVendorId(null); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle campaign results — create a new campaign tab
    const handleCampaignResults = useCallback((vendors: Vendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => {
        const newCampaign: Campaign = {
            id: generateId(),
            query: meta.query,
            location: meta.location,
            vendors,
            timestamp: new Date(),
            sourced: meta.sourced,
            qualified: meta.qualified,
        };
        setCampaigns(prev => [...prev, newCampaign]);
        setActiveCampaignId(newCampaign.id);
    }, []);

    // Approve a vendor — save to Firestore, remove from campaign
    const handleApprove = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        try {
            const { id, ...vendorData } = vendor;
            await addDoc(collection(db, "vendors"), {
                ...vendorData,
                status: 'pending_review',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                source: 'campaign_approved',
            });
            console.log(`✅ Approved "${vendor.businessName}" into CRM.`);
        } catch (error) {
            console.error("Error approving vendor:", error);
            return;
        }

        // Remove from campaign
        setCampaigns(prev => {
            const updated = prev.map(c =>
                c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.id !== vendorId) } : c
            ).filter(c => c.vendors.length > 0); // Auto-remove empty campaigns
            // If active campaign was emptied, switch to last remaining
            if (!updated.find(c => c.id === campaignId) && updated.length > 0) {
                setActiveCampaignId(updated[updated.length - 1].id);
            } else if (updated.length === 0) {
                setActiveCampaignId(null);
            }
            return updated;
        });
    }, [campaigns]);

    // Dismiss a vendor — remove from campaign + blacklist in Firestore
    const handleDismiss = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        // Persist to dismissed_vendors
        await dismissVendorInFirestore(vendor, campaign?.query, campaign?.location);
        console.log(`❌ Dismissed "${vendor.businessName}" — blacklisted from future campaigns.`);

        // Remove from campaign
        setCampaigns(prev => {
            const updated = prev.map(c =>
                c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.id !== vendorId) } : c
            ).filter(c => c.vendors.length > 0);
            if (!updated.find(c => c.id === campaignId) && updated.length > 0) {
                setActiveCampaignId(updated[updated.length - 1].id);
            } else if (updated.length === 0) {
                setActiveCampaignId(null);
            }
            return updated;
        });
    }, [campaigns]);

    // Approve all vendors in a campaign
    const handleApproveAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        for (const vendor of campaign.vendors) {
            try {
                const { id, ...vendorData } = vendor;
                await addDoc(collection(db, "vendors"), {
                    ...vendorData,
                    status: 'pending_review',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    source: 'campaign_approved',
                });
            } catch (error) {
                console.error(`Error approving "${vendor.businessName}":`, error);
            }
        }
        console.log(`✅ Approved all ${campaign.vendors.length} vendors from "${campaign.query}".`);

        setCampaigns(prev => {
            const updated = prev.filter(c => c.id !== campaignId);
            if (updated.length > 0) { setActiveCampaignId(updated[updated.length - 1].id); }
            else { setActiveCampaignId(null); }
            return updated;
        });
    }, [campaigns]);

    // Dismiss all vendors in a campaign (blacklist all)
    const handleDismissAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        // Blacklist all remaining vendors
        for (const vendor of campaign.vendors) {
            await dismissVendorInFirestore(vendor, campaign.query, campaign.location);
        }
        console.log(`❌ Dismissed all ${campaign.vendors.length} vendors from "${campaign.query}".`);

        setCampaigns(prev => {
            const updated = prev.filter(c => c.id !== campaignId);
            if (updated.length > 0) { setActiveCampaignId(updated[updated.length - 1].id); }
            else { setActiveCampaignId(null); }
            return updated;
        });
    }, [campaigns]);

    // Close campaign tab — dismisses all remaining vendors
    const handleCloseCampaign = useCallback(async (campaignId: string) => {
        await handleDismissAll(campaignId);
    }, [handleDismissAll]);

    return (
        <ProtectedRoute resource="supply/recruitment">
            <div className="min-h-screen bg-background transition-colors duration-300 overflow-hidden">
                <main className="w-full h-[calc(100vh-64px)] flex">
                    {/* LEFT PANEL */}
                    <div
                        className={cn(
                            "flex flex-col h-full transition-all duration-300 ease-in-out border-r border-border",
                            selectedVendorId ? "w-1/3 min-w-[400px]" : "w-full"
                        )}
                        onClick={() => handleSelectVendor(null)}
                    >
                        <div className="p-2 pb-0" onClick={(e) => e.stopPropagation()}>
                            <CampaignLauncher onResults={handleCampaignResults} />

                            {/* Campaign Tabs with Preview Results */}
                            <CampaignResultsTable
                                campaigns={campaigns}
                                activeCampaignId={activeCampaignId}
                                onSetActiveCampaign={setActiveCampaignId}
                                onCloseCampaign={handleCloseCampaign}
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

                    {/* RIGHT PANEL */}
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
