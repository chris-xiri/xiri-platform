import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';
import { CheckCircle } from 'lucide-react';

const functions = getFunctions(app);

export function CustomerForm() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        const createLead = httpsCallable(functions, 'createCustomerLead');
        try {
            await createLead(data);
            setSuccess(true);
        } catch (error) {
            console.error(error);
            alert("Error submitting form. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Received</h2>
                    <p className="text-gray-600 mb-6">We will match you with a provider shortly.</p>
                    <Link to="/" className="text-indigo-600 font-medium hover:underline">Return Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 px-8 py-6">
                    <h2 className="text-2xl font-bold text-white">Find a Service Provider</h2>
                    <p className="text-indigo-100 mt-2">Tell us what you need.</p>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Business Name</label>
                        <input name="businessName" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Your Name</label>
                        <input name="contactName" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input name="email" type="email" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input name="phone" type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Location (City/State)</label>
                        <input name="location" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Service Needed</label>
                        <select name="serviceNeeded" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border">
                            <option>Commercial Cleaning</option>
                            <option>HVAC Maintenance</option>
                            <option>Landscaping</option>
                            <option>Security Services</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {loading ? 'Submitting...' : 'Find Vendors'}
                    </button>
                    <div className="text-center mt-4">
                        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">Back</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
