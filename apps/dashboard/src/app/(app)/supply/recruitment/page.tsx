'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CampaignResultsTable, { Campaign, PreviewVendor } from "@/components/supply/CampaignResultsTable";
import { collection, addDoc, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const generateId = () => `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const STORAGE_KEY = 'xiri_campaigns';

// ─── sessionStorage helpers ───
function saveCampaigns(campaigns: Campaign[], activeCampaignId: string | null) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ campaigns, activeCampaignId }));
    } catch { /* quota exceeded or SSR */ }
}

function loadCampaigns(): { campaigns: Campaign[]; activeCampaignId: string | null } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Restore Date objects in searches
        if (parsed.campaigns) {
            parsed.campaigns = parsed.campaigns.map((c: any) => ({
                ...c,
                searches: (c.searches || []).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) })),
            }));
        }
        return parsed;
    } catch { return null; }
}

// ─── Firestore helpers ───
const dismissVendorInFirestore = async (vendor: PreviewVendor) => {
    try {
        const dismissData: Record<string, any> = {
            businessName: vendor.businessName,
            dismissedAt: serverTimestamp(),
        };
        // Store phone/website for robust blacklist matching across searches
        if (vendor.phone) dismissData.phone = vendor.phone;
        if (vendor.website) dismissData.website = vendor.website;
        await addDoc(collection(db, "dismissed_vendors"), dismissData);
    } catch (err) { console.error(`Failed to persist dismissal for "${vendor.businessName}":`, err); }
};

const reviveVendorInFirestore = async (vendor: PreviewVendor) => {
    try {
        const q = query(collection(db, "dismissed_vendors"), where("businessName", "==", vendor.businessName));
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) { await deleteDoc(doc.ref); }
    } catch (err) { console.error(`Failed to revive "${vendor.businessName}":`, err); }
};

export default function RecruitmentPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
    const initialized = useRef(false);

    // Load from sessionStorage on mount
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        const saved = loadCampaigns();
        if (saved && saved.campaigns.length > 0) {
            setCampaigns(saved.campaigns);
            setActiveCampaignId(saved.activeCampaignId);
        }
    }, []);

    // Persist to sessionStorage on every change (after init)
    useEffect(() => {
        if (!initialized.current) return;
        saveCampaigns(campaigns, activeCampaignId);
    }, [campaigns, activeCampaignId]);

    // Create new empty campaign tab
    const handleNewCampaign = useCallback(() => {
        const newCampaign: Campaign = { id: generateId(), label: 'New Campaign', vendors: [], searches: [] };
        setCampaigns(prev => [...prev, newCampaign]);
        setActiveCampaignId(newCampaign.id);
    }, []);

    // Search results — append to active campaign
    const handleSearchResults = useCallback((campaignId: string, vendors: PreviewVendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: [...c.vendors, ...vendors], searches: [...c.searches, { ...meta, timestamp: new Date() }] } : c
        ));
    }, []);

    const handleRenameCampaign = useCallback((campaignId: string, newLabel: string) => {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, label: newLabel } : c));
    }, []);

    const removeVendorFromCampaign = (campaignId: string, vendorId: string) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.id !== vendorId) } : c
        ));
    };

    // Approve — save to Firestore with specified onboarding track
    const handleApprove = useCallback(async (campaignId: string, vendorId: string, track: 'STANDARD' | 'FAST_TRACK') => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;

        try {
            const { id, isDismissed, ...vendorData } = vendor;
            await addDoc(collection(db, "vendors"), {
                ...vendorData,
                status: 'qualified',
                onboardingTrack: track,
                hasActiveContract: track === 'FAST_TRACK',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                source: 'campaign_approved',
            });
            console.log(`✅ Approved "${vendor.businessName}" (${track}) into CRM.`);
        } catch (error) { console.error("Error approving vendor:", error); return; }

        removeVendorFromCampaign(campaignId, vendorId);
    }, [campaigns]);

    // Dismiss — blacklist + remove
    const handleDismiss = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;
        await dismissVendorInFirestore(vendor);
        console.log(`❌ Dismissed "${vendor.businessName}"`);
        removeVendorFromCampaign(campaignId, vendorId);
    }, [campaigns]);

    // Revive — un-dismiss
    const handleRevive = useCallback(async (campaignId: string, vendorId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const vendor = campaign?.vendors.find(v => v.id === vendorId);
        if (!vendor) return;
        await reviveVendorInFirestore(vendor);
        console.log(`🔄 Revived "${vendor.businessName}"`);
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.map(v => v.id === vendorId ? { ...v, isDismissed: false } : v) } : c
        ));
    }, [campaigns]);

    // Approve all active
    const handleApproveAll = useCallback(async (campaignId: string, track: 'STANDARD' | 'FAST_TRACK') => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.vendors.filter(v => !v.isDismissed);
        for (const vendor of active) {
            try {
                const { id, isDismissed, ...vendorData } = vendor;
                await addDoc(collection(db, "vendors"), {
                    ...vendorData,
                    status: 'qualified',
                    onboardingTrack: track,
                    hasActiveContract: track === 'FAST_TRACK',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    source: 'campaign_approved',
                });
            } catch (error) { console.error(`Error approving "${vendor.businessName}":`, error); }
        }
        console.log(`✅ Approved all ${active.length} vendors (${track}) from "${campaign.label}".`);
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.isDismissed) } : c
        ));
    }, [campaigns]);

    // Dismiss all active
    const handleDismissAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.vendors.filter(v => !v.isDismissed);
        for (const vendor of active) { await dismissVendorInFirestore(vendor); }
        console.log(`❌ Dismissed all ${active.length} vendors from "${campaign.label}".`);
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, vendors: c.vendors.filter(v => v.isDismissed) } : c
        ));
    }, [campaigns]);

    // Close campaign tab — discard only + clear from storage
    const handleCloseCampaign = useCallback((campaignId: string) => {
        setCampaigns(prev => {
            const updated = prev.filter(c => c.id !== campaignId);
            if (!updated.find(c => c.id === activeCampaignId) && updated.length > 0) {
                setActiveCampaignId(updated[updated.length - 1].id);
            } else if (updated.length === 0) { setActiveCampaignId(null); }
            return updated;
        });
    }, [activeCampaignId]);

    return (
        <ProtectedRoute resource="supply/recruitment">
            <div className="min-h-screen bg-background transition-colors duration-300 overflow-hidden">
                <main className="w-full h-[calc(100vh-64px)] p-3">
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
                </main>
            </div>
        </ProtectedRoute>
    );
}
