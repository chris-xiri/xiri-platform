import CampaignLauncher from "@/components/CampaignLauncher";
import VendorList from "@/components/VendorList";
import { LayoutDashboard, Users, Settings } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                  Xiri Platform
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <a
                  href="#"
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Recruitment
                </a>
                <a
                  href="#"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  <Users className="w-4 h-4 mr-2" />
                  CRM
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Hidden by default, can be toggled */}
      <div className="sm:hidden bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex flex-col space-y-2">
          <a
            href="#"
            className="text-indigo-600 font-medium flex items-center gap-2 py-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Recruitment
          </a>
          <a
            href="#"
            className="text-gray-500 flex items-center gap-2 py-2"
          >
            <Users className="w-4 h-4" />
            CRM
          </a>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Vendor Recruitment
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-500">
            Manage automated sourcing campaigns and qualify vendor leads.
          </p>
        </div>

        <CampaignLauncher />
        <VendorList />
      </main>
    </div>
  );
}
