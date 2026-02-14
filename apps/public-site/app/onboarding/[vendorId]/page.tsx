"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase"; // Check path
import { Vendor } from "@xiri/shared";
import { Loader2, CheckCircle, Upload, ShieldCheck, Briefcase, Building } from "lucide-react";

export default function OnboardingPage() {
    const params = useParams();
    const vendorId = params?.vendorId as string;

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Form State
    const [liabilityInsurance, setLiabilityInsurance] = useState(false);
    const [hasLLC, setHasLLC] = useState(false);

    // File Upload Mock (In real app, use Firebase Storage)
    const [coiUploaded, setCoiUploaded] = useState(false);
    const [w9Uploaded, setW9Uploaded] = useState(false);

    useEffect(() => {
        if (!vendorId) return;

        const unsubscribe = onSnapshot(doc(db, "vendors", vendorId), (doc) => {
            if (doc.exists()) {
                setVendor({ id: doc.id, ...doc.data() } as Vendor);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    const handleSubmit = async () => {
        if (!vendor) return;
        setSubmitting(true);

        try {
            await updateDoc(doc(db, "vendors", vendor.id!), {
                status: vendor.onboardingTrack === "FAST_TRACK" ? "compliance_review" : "pending_review",
                // Simulate saving form data
                compliance: {
                    ...vendor.compliance,
                    insuranceExp: liabilityInsurance ? new Date() : undefined, // Mock
                    w9Collected: w9Uploaded
                },
                updatedAt: serverTimestamp()
            });
            setCompleted(true);
        } catch (error) {
            console.error("Error submitting onboarding:", error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!vendor) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">Vendor portal not found.</p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Application Received</h2>
                    <p className="text-slate-600">
                        {vendor.onboardingTrack === "FAST_TRACK"
                            ? "Our compliance team is reviewing your documents. Expect a call within 24 hours."
                            : "You have been added to the Xiri Supply Network. We will contact you when jobs match your profile."}
                    </p>
                </div>
            </div>
        );
    }

    const isFastTrack = vendor.onboardingTrack === "FAST_TRACK";

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Dynamic Header */}
            <header className={`${isFastTrack ? "bg-red-600" : "bg-blue-600"} text-white py-12 px-6`}>
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-4 opacity-90">
                        {isFastTrack ? <Briefcase className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                        <span className="font-medium tracking-wide text-sm uppercase">
                            {isFastTrack ? "Urgent Contract Opportunity" : "Partner Network Registration"}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">
                        {isFastTrack ? "Complete Your Compliance Profile" : "Join the Xiri Supply Network"}
                    </h1>
                    <p className="text-lg opacity-90 leading-relaxed max-w-xl">
                        {isFastTrack
                            ? `We have an active contract ready for ${vendor.businessName}. Please upload your documents to be cleared for work.`
                            : `Expand your business with Xiri. Register ${vendor.businessName} to receive commercial cleaning leads.`}
                    </p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto -mt-8 px-6 pb-20">
                <div className="bg-white rounded-xl shadow-xl p-8 border border-slate-100">
                    <div className="mb-8 pb-8 border-b border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Business Information</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="block text-slate-500 mb-1">Company Name</span>
                                <span className="font-medium text-slate-900">{vendor.businessName}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500 mb-1">Primary Email</span>
                                <span className="font-medium text-slate-900">{vendor.email || "N/A"}</span>
                            </div>
                        </div>
                    </div>

                    {isFastTrack ? (
                        /* FAST TRACK UI: File Uploads */
                        <div className="space-y-6">
                            <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex gap-3">
                                <ShieldCheck className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-red-900">Compliance Required</h3>
                                    <p className="text-sm text-red-700 mt-1">
                                        You must upload proof of insurance and a W-9 to be assigned this contract.
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${coiUploaded ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <Upload className={`w-8 h-8 mx-auto mb-3 ${coiUploaded ? "text-green-600" : "text-slate-400"}`} />
                                    <h4 className="font-medium text-slate-900 mb-1">Liability Insurance (COI)</h4>
                                    <p className="text-xs text-slate-500 mb-4">Must be valid for at least 3 months</p>
                                    <button
                                        onClick={() => setCoiUploaded(true)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium ${coiUploaded ? "text-green-700 bg-green-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                                    >
                                        {coiUploaded ? "Uploaded" : "Select File"}
                                    </button>
                                </div>

                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${w9Uploaded ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}>
                                    <Upload className={`w-8 h-8 mx-auto mb-3 ${w9Uploaded ? "text-green-600" : "text-slate-400"}`} />
                                    <h4 className="font-medium text-slate-900 mb-1">IRS Form W-9</h4>
                                    <p className="text-xs text-slate-500 mb-4">Most recent tax year</p>
                                    <button
                                        onClick={() => setW9Uploaded(true)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium ${w9Uploaded ? "text-green-700 bg-green-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                                    >
                                        {w9Uploaded ? "Uploaded" : "Select File"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STANDARD TRACK UI: Checkboxes */
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                                <Network className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-blue-900">Verification Steps</h3>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Please confirm your eligibility. We will request documents only when a job is assigned.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={hasLLC}
                                        onChange={(e) => setHasLLC(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-700 font-medium">I have a registered business entity (LLC/Corp)</span>
                                </label>
                                <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={liabilityInsurance}
                                        onChange={(e) => setLiabilityInsurance(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-700 font-medium">I have General Liability Insurance (Min $1M)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (isFastTrack && (!coiUploaded || !w9Uploaded)) || (!isFastTrack && (!hasLLC || !liabilityInsurance))}
                            className={`px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${submitting
                                    ? "bg-slate-400 cursor-not-allowed"
                                    : isFastTrack
                                        ? "bg-red-600 hover:bg-red-700 hover:shadow-red-200"
                                        : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {submitting ? "Processing..." : isFastTrack ? "Submit Compliance Docs" : "Complete Registration"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
