
import { LayoutDashboard, Users, Settings } from 'lucide-react';
import VendorList from './components/VendorList';
import CampaignLauncher from './components/CampaignLauncher';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-indigo-600 tracking-tight">Xiri Platform</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <a href="#" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Recruitment
                </a>
                <a href="#" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  <Users className="w-4 h-4 mr-2" />
                  CRM
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <button className="p-2 rounded-full text-gray-400 hover:text-gray-500">
                <Settings className="w-5 h-5" />
              </button>
              <div className="ml-3 relative">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  JD
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Vendor Recruitment</h1>
            <p className="mt-1 text-sm text-gray-500">Manage automated sourcing campaigns and qualify vendor leads.</p>
          </div>

          <CampaignLauncher />

          <VendorList />

        </div>
      </main>
    </div>
  )
}

export default App
