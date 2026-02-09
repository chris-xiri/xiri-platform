'use client';

import CampaignLauncher from "@/components/CampaignLauncher";
import VendorList from "@/components/VendorList";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function RecruitmentPage() {
  return (
    <ProtectedRoute resource="supply/recruitment">
      <div className="min-h-screen bg-background transition-colors duration-300">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col h-[calc(100vh-64px)]">
          <CampaignLauncher />
          <div className="flex-1 overflow-hidden">
            <VendorList
              title="Recruitment Pipeline"
              statusFilters={['PENDING_REVIEW', 'SCRAPED']}
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
