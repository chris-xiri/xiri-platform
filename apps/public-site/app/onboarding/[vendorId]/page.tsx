"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Vendor } from "@xiri/shared";
import { Loader2, CheckCircle, Upload, ShieldCheck, Briefcase, Building, Globe } from "lucide-react";
import { t } from "../translations";

export default function OnboardingPage() {
    const params = useParams();
    const vendorId = params?.vendorId as string;

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [language, setLanguage] = useState<'en' | 'es'>('en');

    // Editable Business Info
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Form State - Insurance
    const [hasBusinessEntity, setHasBusinessEntity] = useState(false);
    const [hasGeneralLiability, setHasGeneralLiability] = useState(false);
    const [hasWorkersComp, setHasWorkersComp] = useState(false);
    const [hasAutoInsurance, setHasAutoInsurance] = useState(false);
    const [hasPollutionLiability, setHasPollutionLiability] = useState(false);

    // Track Selection & Analytics
    const searchParams = useSearchParams();
    const initialTrack = (searchParams?.get('track')?.toUpperCase() || 'STANDARD') as 'STANDARD' | 'FAST_TRACK';
    const [currentTrack, setCurrentTrack] = useState<'STANDARD' | 'FAST_TRACK'>(initialTrack);
    const [analyticsDocRef, setAnalyticsDocRef] = useState<any>(null);

    // File Upload Mock (In real app, use Firebase Storage)
    const [coiUploaded, setCoiUploaded] = useState(false);
    const [w9Uploaded, setW9Uploaded] = useState(false);

    // State-based insurance requirements
    const vendorState = vendor?.state || 'NY';
    const requiresWorkersComp = vendorState !== 'TX';
    const requiresPollution = vendor?.capabilities?.includes('medical');

    useEffect(() => {
        if (!vendorId) return;

        const unsubscribe = onSnapshot(doc(db, "vendors", vendorId), (doc) => {
            if (doc.exists()) {
                const vendorData = { id: doc.id, ...doc.data() } as Vendor;
                setVendor(vendorData);

                // Initialize editable fields from vendor data
                setCompanyName(vendorData.businessName || '');
                setEmail(vendorData.email || '');
                // Format phone number on load
                const rawPhone = vendorData.phone || '';
                const formattedPhone = rawPhone.replace(/\D/g, '');
                if (formattedPhone.length === 10) {
                    setPhone(`(${formattedPhone.slice(0, 3)}) ${formattedPhone.slice(3, 6)}-${formattedPhone.slice(6, 10)}`);
                } else {
                    setPhone(rawPhone);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    // Initialize Analytics on Page Load
    useEffect(() => {
        const initAnalytics = async () => {
            if (!vendorId) return;

            const analyticsRef = doc(db, 'onboarding_analytics', vendorId);
            setAnalyticsDocRef(analyticsRef);

            try {
                await setDoc(analyticsRef, {
                    vendorId,
                    track: currentTrack,
                    steps: {
                        step1_contact_info: { startedAt: serverTimestamp() }
                    },
                    createdAt: serverTimestamp(),
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                    referrer: typeof document !== 'undefined' ? document.referrer : ''
                }, { merge: true });
            } catch (error) {
                console.error('Error initializing analytics:', error);
            }
        };

        initAnalytics();
    }, [vendorId, currentTrack]);

    // Track Toggle Handler
    const handleTrackToggle = async (newTrack: 'STANDARD' | 'FAST_TRACK') => {
        setCurrentTrack(newTrack);

        if (analyticsDocRef) {
            try {
                await updateDoc(analyticsDocRef, {
                    track: newTrack,
                    trackToggled: true
                });
            } catch (error) {
                console.error('Error updating track:', error);
            }
        }
    };

    // Phone number formatting helper
    const formatPhoneNumber = (value: string) => {
        // Remove all non-digits
        const phoneNumber = value.replace(/\D/g, '');

        // Format as (xxx) xxx-xxxx
        if (phoneNumber.length <= 3) {
            return phoneNumber;
        } else if (phoneNumber.length <= 6) {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        } else {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setPhone(formatted);
    };

    const handleSubmit = async () => {
        if (!vendor) return;
        setSubmitting(true);

        try {
            const complianceData: any = {
                hasBusinessEntity,
                generalLiability: {
                    hasInsurance: hasGeneralLiability,
                    verified: false
                },
                workersComp: {
                    hasInsurance: hasWorkersComp,
                    verified: false
                },
                autoInsurance: {
                    hasInsurance: hasAutoInsurance,
                    verified: false
                },
                w9Collected: w9Uploaded
            };

            // Add trade-specific insurance if applicable
            if (requiresPollution) {
                complianceData.additionalInsurance = [{
                    type: 'Pollution Liability',
                    hasInsurance: hasPollutionLiability,
                    verified: false
                }];
            }

            // Update vendor document
            await updateDoc(doc(db, "vendors", vendor.id!), {
                businessName: companyName,
                email,
                phone,
                status: 'compliance_review', // NEW: Set to compliance_review instead of active
                onboardingTrack: currentTrack, // NEW: Save selected track
                compliance: complianceData,
                updatedAt: serverTimestamp()
            });

            // Mark analytics as completed
            if (analyticsDocRef) {
                try {
                    await updateDoc(analyticsDocRef, {
                        'steps.step4_submission.completedAt': serverTimestamp(),
                        completedAt: serverTimestamp()
                    });
                } catch (error) {
                    console.error('Error completing analytics:', error);
                }
            }

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

    const isFastTrack = currentTrack === "FAST_TRACK";

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Dynamic Header */}
            <header className={`${isFastTrack ? "bg-purple-600" : "bg-blue-600"} text-white py-12 px-6`}>
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
                    {/* Track Toggle - At Top of Form */}
                    <div className="mb-8 pb-8 border-b border-slate-200">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 text-center">Select Your Track</h2>
                        <div className="flex justify-center gap-4">
                            <button
                                type="button"
                                onClick={() => handleTrackToggle('STANDARD')}
                                className={`flex-1 max-w-xs px-6 py-4 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md border-2 ${currentTrack === 'STANDARD'
                                        ? 'bg-blue-50 text-blue-700 border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-base font-bold">Standard Network</div>
                                    <div className="text-xs mt-1 opacity-75">Join our contractor network</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTrackToggle('FAST_TRACK')}
                                className={`flex-1 max-w-xs px-6 py-4 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md border-2 ${currentTrack === 'FAST_TRACK'
                                        ? 'bg-purple-50 text-purple-700 border-purple-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-base font-bold">Urgent Contract</div>
                                    <div className="text-xs mt-1 opacity-75">Fast-track for immediate work</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Qualification Questions */}
                    <div className="mb-8 pb-8 border-b border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Qualification</h2>
                        <p className="text-sm text-slate-600 mb-6 italic">Calificación</p>

                        <div className="space-y-6">
                            {/* Business Entity */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-3">
                                    Do you have a registered business entity (LLC/Corp)?
                                    <span className="block text-xs text-slate-500 italic mt-1">¿Tiene una entidad comercial registrada (LLC/Corp)?</span>
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setHasBusinessEntity(true)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasBusinessEntity === true
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes <span className="text-sm opacity-80">/ Sí</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasBusinessEntity(false)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasBusinessEntity === false
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>

                            {/* General Liability */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-3">
                                    Do you have General Liability Insurance ($1M minimum)?
                                    <span className="block text-xs text-slate-500 italic mt-1">¿Tiene Seguro de Responsabilidad General (mínimo $1M)?</span>
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setHasGeneralLiability(true)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasGeneralLiability === true
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes <span className="text-sm opacity-80">/ Sí</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasGeneralLiability(false)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasGeneralLiability === false
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>

                            {/* Workers Comp */}
                            <div className={requiresWorkersComp ? 'p-4 bg-orange-50 border border-orange-200 rounded-lg' : ''}>
                                <label className="block text-sm font-medium text-slate-900 mb-3">
                                    Do you have Workers' Compensation Insurance?
                                    {requiresWorkersComp && <span className="text-orange-600 ml-2">(Required in {vendorState})</span>}
                                    <span className="block text-xs text-slate-500 italic mt-1">¿Tiene Seguro de Compensación para Trabajadores?</span>
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setHasWorkersComp(true)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasWorkersComp === true
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes <span className="text-sm opacity-80">/ Sí</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasWorkersComp(false)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasWorkersComp === false
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>

                            {/* Commercial Auto */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-3">
                                    Do you have Commercial Auto Insurance?
                                    <span className="block text-xs text-slate-500 italic mt-1">¿Tiene Seguro de Auto Comercial?</span>
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setHasAutoInsurance(true)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasAutoInsurance === true
                                            ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes <span className="text-sm opacity-80">/ Sí</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasAutoInsurance(false)}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasAutoInsurance === false
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>

                            {/* Pollution Liability (if medical) */}
                            {requiresPollution && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <label className="block text-sm font-medium text-blue-900 mb-3">
                                        Do you have Pollution Liability Insurance?
                                        <span className="text-blue-600 ml-2">(Required for medical facilities)</span>
                                        <span className="block text-xs text-blue-700 italic mt-1">¿Tiene Seguro de Responsabilidad por Contaminación?</span>
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setHasPollutionLiability(true)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasPollutionLiability === true
                                                ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes <span className="text-sm opacity-80">/ Sí</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasPollutionLiability(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasPollutionLiability === false
                                                ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Business Info SECOND */}
                    <div className="mb-8 pb-8 border-b border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">Business Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Enter company name"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Primary Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter email address"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    placeholder="(555) 123-4567"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || hasBusinessEntity !== true || hasGeneralLiability !== true}
                            className={`px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${submitting || hasBusinessEntity !== true || hasGeneralLiability !== true
                                ? "bg-slate-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl"
                                }`}
                        >
                            {submitting ? "Submitting..." : "Complete Onboarding"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
