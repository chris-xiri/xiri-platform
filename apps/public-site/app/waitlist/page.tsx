"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ArrowRight, MapPin } from "lucide-react";

export default function WaitlistPage() {
    const searchParams = useSearchParams();
    const zip = searchParams.get("zip");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await addDoc(collection(db, "waitlist"), {
                email,
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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    📍
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">We're not there yet!</h1>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    XIRI is currently operating in select markets.
                    Join the waitlist to be notified when we expand to your area.
                </p>
                {success ? (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100">
                        <p className="font-bold">Thanks for your interest!</p>
                        <p className="text-sm">We'll notify you when we launch in {zip}.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="text-left">
                            <label className="text-sm font-bold text-gray-700 mb-1 block">Get Notified</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                            />
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
