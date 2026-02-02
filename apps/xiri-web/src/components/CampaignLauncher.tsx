
import { useState } from 'react';
import { Search, MapPin, Zap } from 'lucide-react';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

export default function CampaignLauncher() {
    const [specialty, setSpecialty] = useState('');
    const [location, setLocation] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            query: specialty,
            location: location,
            hasActiveContract: urgent
        };

        console.log("🚀 Launching Campaign:", payload);

        try {
            const generateLeads = httpsCallable(functions, 'generateLeads');
            await generateLeads(payload);

            alert(`Campaign Launched! Sourcing ${specialty} in ${location}.`);
            setSpecialty('');
            setLocation('');
        } catch (err: any) {
            console.error(err);
            alert("Error launching campaign: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                Launch New Recruitment Campaign
            </h2>

            <form onSubmit={handleLaunch} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specialty / Trade</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            required
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                            placeholder="e.g. HVAC, Commercial Cleaning"
                        />
                    </div>
                </div>

                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Location</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapPin className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            required
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2.5"
                            placeholder="e.g. New York, NY"
                        />
                    </div>
                </div>

                <div className="flex items-center h-10 pb-1">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input type="checkbox" className="sr-only" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${urgent ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${urgent ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-sm text-gray-700 font-medium">
                            {urgent ? 'Urgent (Active Contract)' : 'Building Supply'}
                        </div>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`h-10 px-6 py-2 rounded-md font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                        ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    {loading ? 'Launching...' : 'Launch Agents'}
                </button>
            </form>
        </div>
    );
}
