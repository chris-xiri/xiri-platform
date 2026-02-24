'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LeadSourcingCampaignTable, { type PropertyCampaign, type CampaignPreviewProperty } from "@/components/sales/LeadSourcingCampaignTable";
import { collection, addDoc, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const generateId = () => `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const STORAGE_KEY = 'xiri_property_campaigns';

// ─── localStorage helpers ───
function saveCampaigns(campaigns: PropertyCampaign[], activeCampaignId: string | null) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ campaigns, activeCampaignId }));
    } catch { /* quota exceeded or SSR */ }
}

function loadCampaigns(): { campaigns: PropertyCampaign[]; activeCampaignId: string | null } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.campaigns) {
            parsed.campaigns = parsed.campaigns.map((c: any) => ({
                ...c,
                searches: (c.searches || []).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) })),
            }));
        }
        return parsed;
    } catch { return null; }
}

export default function LeadSourcingPage() {
    const [campaigns, setCampaigns] = useState<PropertyCampaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
    const initialized = useRef(false);

    // Load from localStorage on mount
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        const saved = loadCampaigns();
        if (saved && saved.campaigns.length > 0) {
            setCampaigns(saved.campaigns);
            setActiveCampaignId(saved.activeCampaignId);
        }
    }, []);

    // Persist to localStorage on every change
    useEffect(() => {
        if (!initialized.current) return;
        saveCampaigns(campaigns, activeCampaignId);
    }, [campaigns, activeCampaignId]);

    // Create new empty campaign tab
    const handleNewCampaign = useCallback(() => {
        const newCampaign: PropertyCampaign = { id: generateId(), label: 'New Campaign', properties: [], searches: [] };
        setCampaigns(prev => [...prev, newCampaign]);
        setActiveCampaignId(newCampaign.id);
    }, []);

    // Search results — append to active campaign
    const handleSearchResults = useCallback((campaignId: string, properties: CampaignPreviewProperty[], meta: { query: string; location: string; sourced: number }) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, properties: [...c.properties, ...properties], searches: [...c.searches, { ...meta, timestamp: new Date() }] } : c
        ));
    }, []);

    const handleRenameCampaign = useCallback((campaignId: string, newLabel: string) => {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, label: newLabel } : c));
    }, []);

    const removePropertyFromCampaign = (campaignId: string, propertyId: string) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, properties: c.properties.filter(p => p.id !== propertyId) } : c
        ));
    };

    // Approve — graduate to leads collection
    const handleApprove = useCallback(async (campaignId: string, propertyId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const property = campaign?.properties.find(p => p.id === propertyId);
        if (!property) return;

        try {
            await addDoc(collection(db, "leads"), {
                businessName: property.tenantName || property.name,
                facilityType: property.facilityType || mapPropertyType(property.propertyType),
                contactName: property.ownerName || '',
                contactPhone: property.ownerPhone || '',
                email: property.ownerEmail || '',
                zipCode: property.zip || '',
                address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
                status: 'new',
                attribution: {
                    source: 'property_sourcing',
                    medium: property.source || 'mock',
                    campaign: campaign?.label || 'sourcing',
                    landingPage: '',
                },
                propertySourcing: {
                    sourceProvider: property.source,
                    sourcePropertyId: property.sourceId,
                    squareFootage: property.squareFootage,
                    yearBuilt: property.yearBuilt,
                    ownerName: property.ownerName,
                    tenantName: property.tenantName,
                    tenantCount: property.tenantCount,
                    lastSalePrice: property.lastSalePrice,
                    lastSaleDate: property.lastSaleDate,
                    sourcedAt: new Date(),
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`✅ Approved "${property.name}" into Sales CRM.`);
        } catch (error) { console.error("Error approving property:", error); return; }

        removePropertyFromCampaign(campaignId, propertyId);
    }, [campaigns]);

    // Dismiss — remove from campaign
    const handleDismiss = useCallback(async (campaignId: string, propertyId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        const property = campaign?.properties.find(p => p.id === propertyId);
        if (!property) return;
        console.log(`❌ Dismissed "${property.name}"`);
        removePropertyFromCampaign(campaignId, propertyId);
    }, [campaigns]);

    // Revive — no longer needed since Dismiss removes immediately, but keeping stub for prop
    const handleRevive = useCallback(async (campaignId: string, propertyId: string) => {
        console.log(`🔄 Revived property`);
    }, [campaigns]);

    // Approve all active
    const handleApproveAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.properties.filter(p => !p.isDismissed);
        for (const property of active) {
            try {
                await addDoc(collection(db, "leads"), {
                    businessName: property.tenantName || property.name,
                    facilityType: property.facilityType || mapPropertyType(property.propertyType),
                    contactName: property.ownerName || '',
                    contactPhone: property.ownerPhone || '',
                    email: property.ownerEmail || '',
                    zipCode: property.zip || '',
                    address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
                    status: 'new',
                    attribution: {
                        source: 'property_sourcing',
                        medium: property.source || 'mock',
                        campaign: campaign.label || 'sourcing',
                        landingPage: '',
                    },
                    propertySourcing: {
                        sourceProvider: property.source,
                        sourcePropertyId: property.sourceId,
                        squareFootage: property.squareFootage,
                        yearBuilt: property.yearBuilt,
                        ownerName: property.ownerName,
                        tenantName: property.tenantName,
                        tenantCount: property.tenantCount,
                        lastSalePrice: property.lastSalePrice,
                        lastSaleDate: property.lastSaleDate,
                        sourcedAt: new Date(),
                    },
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            } catch (error) { console.error(`Error approving "${property.name}":`, error); }
        }
        console.log(`✅ Approved all ${active.length} properties from "${campaign.label}".`);
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, properties: c.properties.filter(p => p.isDismissed) } : c
        ));
    }, [campaigns]);

    // Dismiss all active — remove from campaign
    const handleDismissAll = useCallback(async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;
        const active = campaign.properties.filter(p => !p.isDismissed);
        console.log(`❌ Dismissed all ${active.length} properties from "${campaign.label}".`);
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, properties: c.properties.filter(p => p.isDismissed) } : c
        ));
    }, [campaigns]);

    // Close campaign tab
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
        <ProtectedRoute resource="sales/crm">
            <div className="min-h-screen bg-background transition-colors duration-300 overflow-hidden">
                <main className="w-full h-[calc(100vh-64px)] p-3">
                    <LeadSourcingCampaignTable
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

// Helper: map raw propertyType to XIRI FacilityType
function mapPropertyType(propertyType?: string): string {
    if (!propertyType) return 'office_general';
    const map: Record<string, string> = {
        'medical_office': 'medical_urgent_care',
        'auto_dealership': 'auto_dealer_showroom',
        'auto_service': 'auto_service_center',
        'retail': 'office_general',
    };
    return map[propertyType] || 'office_general';
}
