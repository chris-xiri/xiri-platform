'use client';

import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CRMPage() {
    return (
        <ProtectedRoute resource="supply/crm">
            <main className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col h-[calc(100vh-64px)]">
                <h1 className="text-2xl font-bold text-foreground mb-4">CRM Dashboard</h1>
                <div className="flex-1 overflow-hidden">
                    <VendorList
                        title="Vendor CRM"
                    />
                </div>
            </main>
        </ProtectedRoute>
    )
}
