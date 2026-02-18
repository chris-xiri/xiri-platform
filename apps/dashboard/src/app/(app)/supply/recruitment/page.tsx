'use client';

import { useState, useEffect, useCallback } from 'react';
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RecruitmentDetailView from "@/components/supply/RecruitmentDetailView";
import CampaignResultsTable, { Campaign, PreviewVendor } from "@/components/supply/CampaignResultsTable";
import { cn } from "@/lib/utils";
import { collection, addDoc, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const generateId = () => `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// Write vendor to dismissed_vendors collection
const dismissVendorInFirestore = async (vendor: PreviewVendor) => {
    try {
        await addDoc(collection(db, "dismissed_vendors"), {
            businessName: vendor.businessName,
            dismissedAt: serverTimestamp(),
        });
    } catch (err) {
        console.error(`Failed to persist dismissal for "${vendor.businessName}":`, err);
    }
};

// Remove vendor from dismissed_vendors collection (revive)
const reviveVendorInFirestore = async (vendor: PreviewVendor) => {
    try {
        const q = query(collection(db, "dismissed_vendors"), where("businessName", "==", vendor.businessName));
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
            await deleteDoc(doc.ref);
        }
    } catch (err) {
        console.error(`Failed to revive "${vendor.businessName}":`, err);
    }
};

export default function RecruitmentPage() {
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

    const handleSelectVendor = (id: string | null) => {
        if (id === null) { setSelectedVendorId(null); return; }
        setSelectedVendorId(prev => prev === id ? null : id);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedVendorId(null); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Create new empty campaign tab
    const handleNewCampaign = useCallback(() => {
        const newCampaign: Campaign = {
            id: generateId(),
            label: 'New Campaign',
            vendors: [],
            searches: [],
        };
        setCampaigns(prev => [...prev, newCampaign]);
        setActiveCampaignId(newCampaign.id);
    }, []);

    // Search results come in — append to the active campaign
    const handleSearchResults = useCallback((campaignId: string, vendors: PreviewVendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? {
                ...c,
                vendors: [...c.vendors, ...vendors],
                searches: [...c.searches, { ...meta, timestamp: new Date() }],
            } : c
        ));
    }, []);

    // Rename a campaign tab
    const handleRenameCampaign = useCallback((campaignId: string, newLabel: string) => {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, label: newLabel } : c));
    }, []);

    // Remove vendor from campaign state
    const removeVendorFromCampaign = (campaignId: string, vendorId: string) => {
        setCampaigns(prev => {
            const updated = prev.map(c =>
                c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.id !== vendorId) } : c
            );
            return updated;
        });
    };

    // Approve a vendor — save to Firestore, remove from campaign
    const handleApprove = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        try {
            const { id, isDismissed, ...vendorData } = vendor;
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

        removeVendorFromCampaign(campaignId, vendorId);
    }, [campaigns]);

    // Dismiss a vendor — blacklist + remove from campaign
    const handleDismiss = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        await dismissVendorInFirestore(vendor);
        console.log(`❌ Dismissed "${vendor.businessName}"`);
        removeVendorFromCampaign(campaignId, vendorId);
    }, [campaigns]);

    // Revive a vendor — remove from dismissed_vendors, update isDismissed flag
    const handleRevive = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        await reviveVendorInFirestore(vendor);
        console.log(`🔄 Revived "${vendor.businessName}"`);

        setCampaigns(prev => prev.map(c =>
            c.id === campaignId
                ? { ...c, vendors: c.vendors.map(v => v.id === vendorId ? { ...v, isDismissed: false } : v) }
                : c
        ));
    }, [campaigns]);

    // Approve all active vendors in a campaign
    const handleApproveAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.vendors.filter(v => !v.isDismissed);

        for (const vendor of active) {
            try {
                const { id, isDismissed, ...vendorData } = vendor;
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
        console.log(`✅ Approved all ${active.length} vendors from "${campaign.label}".`);

        // Remove only active vendors (keep dismissed ones in case user wants to revive later)
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.isDismissed) } : c
        ));
    }, [campaigns]);

    // Dismiss all active vendors in a campaign
    const handleDismissAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.vendors.filter(v => !v.isDismissed);

        for (const vendor of active) {
            await dismissVendorInFirestore(vendor);
        }
        console.log(`❌ Dismissed all ${active.length} vendors from "${campaign.label}".`);

        // Remove active vendors from campaign
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.isDismissed) } : c
        ));
    }, [campaigns]);

    // Close campaign tab — just discards preview
    const handleCloseCampaign = useCallback((campaignId: string) => {
        setCampaigns(prev => {
            const updated = prev.filter(c => c.id !== campaignId);
            if (!updated.find(c => c.id === activeCampaignId) && updated.length > 0) {
                setActiveCampaignId(updated[updated.length - 1].id);
            } else if (updated.length === 0) {
                setActiveCampaignId(null);
            }
            return updated;
        });
    }, [activeCampaignId]);

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
                            <CampaignResultsTable
                                campaigns={campaigns}
                                activeCampaignId={activeCampaignId}
                                onSetActiveCampaign={setActiveCampaignId}
                                onNewCampaign={handleNewCampaign}
                                onCloseCampaign={handleCloseCampaign}
                                onSearchResults={handleSearchResults}
                                onApprove={handleApprove}
                                onDismiss={handleDismiss}
                                onRevive={handleRevive}
                                onApproveAll={handleApproveAll}
                                onDismissAll={handleDismissAll}
                                onRenameCampaign={handleRenameCampaign}
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
