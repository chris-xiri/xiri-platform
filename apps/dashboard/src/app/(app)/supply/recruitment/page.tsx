'use client';

import { useState, useEffect } from 'react';
import CampaignLauncher from "@/components/CampaignLauncher";
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RecruitmentDetailView from "@/components/supply/RecruitmentDetailView";
import { cn } from "@/lib/utils";

export default function RecruitmentPage() {
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

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
                            <CampaignLauncher />
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
