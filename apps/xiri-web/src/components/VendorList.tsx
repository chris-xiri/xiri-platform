
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Phone, Mail, Globe, AlertCircle, CheckCircle, XCircle, ArrowUpDown } from 'lucide-react';

interface Vendor {
    id: string;
    companyName: string;
    specialty: string;
    location: string;
    status: string;
    fitScore?: number;
    phone?: string;
    email?: string;
    website?: string;
    businessType?: string;
    createdAt: Timestamp;
}

export default function VendorList() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<keyof Vendor>('fitScore');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

    const handleSort = (field: keyof Vendor) => {
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedVendors = [...vendors].sort((a, b) => {
        const aValue = a[sortField] ?? '';
        const bValue = b[sortField] ?? '';

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const getScoreColor = (score: number = 0) => {
        if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
        if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-red-50 text-red-800 border-red-200'; // Low score warning
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading pipeline data...</div>;

    return (
        <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">Sourced Vendors</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {vendors.length} Total
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th
                                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                                onClick={() => handleSort('companyName')}
                            >
                                <div className="flex items-center">
                                    Company
                                    <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400 opacity-0 group-hover:opacity-100" />
                                </div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('fitScore')}
                            >
                                <div className="flex items-center">
                                    Fit Score
                                    <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                                </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedVendors.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center">
                                        <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                                        <p>No vendors found. Launch a New Campaign.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : sortedVendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900">{vendor.companyName}</div>
                                    <div className="text-xs text-gray-500">{vendor.location}</div>
                                    <div className="text-xs text-gray-400 mt-1 truncate max-w-xs" title={vendor.specialty}>{vendor.specialty}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${getScoreColor(vendor.fitScore)}`}>
                                        {vendor.fitScore ?? 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {vendor.phone ? (
                                            <div className="group relative">
                                                <Phone className="w-4 h-4 text-green-600 cursor-help" />
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                    {vendor.phone}
                                                </span>
                                            </div>
                                        ) : <Phone className="w-4 h-4 text-gray-300" />}

                                        {vendor.website ? (
                                            <a href={vendor.website} target="_blank" rel="noopener noreferrer">
                                                <Globe className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                                            </a>
                                        ) : <Globe className="w-4 h-4 text-gray-300" />}

                                        {vendor.email ? (
                                            <Mail className="w-4 h-4 text-indigo-500" />
                                        ) : <Mail className="w-4 h-4 text-gray-300" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {vendor.businessType === 'Franchise' ? (
                                        <span className="text-purple-600 font-medium text-xs bg-purple-50 px-2 py-0.5 rounded">Franchise</span>
                                    ) : (
                                        <span className="text-gray-600 text-xs">Indep.</span>
                                    )}
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
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleStatusUpdate(vendor.id, 'APPROVED')}
                                            disabled={vendor.status === 'APPROVED'}
                                            className="text-green-600 hover:text-green-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(vendor.id, 'REJECTED')}
                                            disabled={vendor.status === 'REJECTED'}
                                            className="text-red-600 hover:text-red-900 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
