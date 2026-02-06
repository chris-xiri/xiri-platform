import VendorList from "@/components/VendorList";

export default function CRMPage() {
    return (
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col h-[calc(100vh-64px)]">
            <h1 className="text-2xl font-bold text-foreground mb-4">CRM Dashboard</h1>
            <div className="flex-1 overflow-hidden">
                <VendorList
                    title="Active Vendors"
                    statusFilters={['APPROVED', 'CONTACTED', 'NEGOTIATING', 'CONTRACTED']}
                />
            </div>
        </main>
    )
}
