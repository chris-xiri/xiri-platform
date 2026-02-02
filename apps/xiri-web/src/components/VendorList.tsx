
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';


interface Vendor {
    id: string;
    companyName: string;
    specialty: string;
    location: string;
    status: string;
    fitScore?: number;
    hasActiveContract?: boolean;
    createdAt: Timestamp;
}

export default function VendorList() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Vendor[];
            setVendors(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching vendors:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleStatusUpdate = async (vendorId: string, newStatus: string) => {
        try {
            const vendorRef = doc(db, "vendors", vendorId);
            await updateDoc(vendorRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status");
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading pipeline...</div>;

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Recruitment Pipeline</h3>
                <span className="text-sm text-gray-500">{vendors.length} Candidates</span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialty</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fit Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {vendors.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    No vendors found. Launch a campaign to get started.
                                </td>
                            </tr>
                        ) : vendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{vendor.companyName}</div>
                                    <div className="text-xs text-gray-400">ID: {vendor.id.slice(0, 8)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {vendor.specialty}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {vendor.location}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${(vendor.fitScore || 0) >= 80 ? 'bg-green-100 text-green-800' :
                                            (vendor.fitScore || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'}`}>
                                        {vendor.fitScore ?? 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${vendor.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                            vendor.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                'bg-blue-100 text-blue-800'}`}>
                                        {vendor.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleStatusUpdate(vendor.id, 'APPROVED')}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4 disabled:opacity-50"
                                        disabled={vendor.status === 'APPROVED'}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(vendor.id, 'REJECTED')}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                        disabled={vendor.status === 'REJECTED'}
                                    >
                                        Reject
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
