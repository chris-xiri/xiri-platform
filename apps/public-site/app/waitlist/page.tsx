"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ArrowRight, MapPin } from "lucide-react";

function WaitlistContent() {
    const searchParams = useSearchParams();
    const zip = searchParams.get("zip");
    const [email, setEmail] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [facilityType, setFacilityType] = useState("");
    const [sqft, setSqft] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await addDoc(collection(db, "waitlist"), {
                email,
                businessName: businessName || null,
                facilityType: facilityType || null,
                estimatedSqft: sqft ? parseInt(sqft) : null,
                zipCode: zip,
                source: "alpha_rejection",
                createdAt: serverTimestamp()
            });
            setSuccess(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const inputStyles = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none text-sm";

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    📍
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">We&apos;re not there yet!</h1>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    XIRI is currently operating in select markets.
                    Join the waitlist to be notified when we expand to your area.
                </p>
                {success ? (
                    <div className="bg-green-50 text-green-700 p-6 rounded-xl border border-green-100">
                        <p className="font-bold text-lg mb-1">Thanks for your interest!</p>
                        <p className="text-sm">We&apos;ll notify you when we launch in {zip}.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div>
                            <label className="text-sm font-bold text-gray-700 mb-1 block">Email *</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className={inputStyles}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 mb-1 block">Business Name</label>
                            <input
                                type="text"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Acme Medical Group"
                                className={inputStyles}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-1 block">Facility Type</label>
                                <select
                                    value={facilityType}
                                    onChange={(e) => setFacilityType(e.target.value)}
                                    className={`${inputStyles} text-gray-700 bg-white`}
                                >
                                    <option value="">Select...</option>
                                    <option value="medical">Medical Office</option>
                                    <option value="urgent_care">Urgent Care</option>
                                    <option value="surgery_center">Surgery Center</option>
                                    <option value="auto_dealership">Auto Dealership</option>
                                    <option value="daycare">Daycare / Preschool</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-1 block">Est. Sq Ft</label>
                                <input
                                    type="number"
                                    value={sqft}
                                    onChange={(e) => setSqft(e.target.value)}
                                    placeholder="5,000"
                                    className={inputStyles}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Notify Me"}
                        </button>
                    </form>
                )}

                <p className="text-xs text-gray-400 mt-6">
                    Zip Code Requested: <span className="font-mono">{zip || "Unknown"}</span>
                </p>
            </div>
        </div>
    );
}

export default function WaitlistPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                </div>
            </div>
        }>
            <WaitlistContent />
        </Suspense>
    );
}
