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
                            {isFastTrack ? "Express Onboarding - Work Available Now" : "Partner Network Application"}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">
                        {isFastTrack ? "Get Started Today" : "Join the Xiri Partner Network"}
                    </h1>
                    <p className="text-lg opacity-90 leading-relaxed max-w-xl">
                        {isFastTrack
                            ? `We have active contracts ready for ${vendor.businessName}. Complete your profile and upload documents to start earning immediately.`
                            : `Build your business with Xiri. Register ${vendor.businessName} and we'll connect you with commercial cleaning opportunities.`}
                    </p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto -mt-8 px-6 pb-20">
                <div className="bg-white rounded-xl shadow-xl p-8 border border-slate-100">
                    {/* Track Toggle - Simplified */}
                    <div className="mb-6 pb-6 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">What brings you here?</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => handleTrackToggle('STANDARD')}
                                className={`p-4 rounded-lg text-left transition-all border-2 ${currentTrack === 'STANDARD'
                                    ? 'bg-blue-50 border-blue-500 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentTrack === 'STANDARD' ? 'border-blue-500' : 'border-gray-300'
                                        }`}>
                                        {currentTrack === 'STANDARD' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-900 text-base">Join Our Network</div>
                                        <div className="text-sm text-slate-600 mt-1">We'll actively find work that matches your skills</div>
                                    </div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTrackToggle('FAST_TRACK')}
                                className={`p-4 rounded-lg text-left transition-all border-2 ${currentTrack === 'FAST_TRACK'
                                    ? 'bg-purple-50 border-purple-500 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentTrack === 'FAST_TRACK' ? 'border-purple-500' : 'border-gray-300'
                                        }`}>
                                        {currentTrack === 'FAST_TRACK' && <div className="w-3 h-3 rounded-full bg-purple-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-900 text-base">I Need Work Now</div>
                                        <div className="text-sm text-slate-600 mt-1">Jobs ready - just need your paperwork</div>
                                    </div>
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
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    Do you have a registered business entity (LLC/Corp)?
                                    <span className="block text-xs text-slate-500 mt-1">¿Tiene una entidad comercial registrada (LLC/Corp)?</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHasBusinessEntity(true)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasBusinessEntity === true
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes / Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasBusinessEntity(false)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasBusinessEntity === false
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>

                                {/* LLC Name Input - appears after Yes */}
                                {hasBusinessEntity === true && (
                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <label className="block text-sm font-medium text-slate-900 mb-2">
                                            What's your business name?
                                            <span className="block text-xs text-slate-500 mt-0.5">¿Cuál es el nombre de su negocio?</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g., ABC Cleaning Services LLC"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* General Liability */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    Do you have General Liability insurance?
                                    <span className="block text-xs text-slate-500 mt-1">¿Tiene seguro de responsabilidad general?</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHasGeneralLiability(true)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasGeneralLiability === true
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes / Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasGeneralLiability(false)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasGeneralLiability === false
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>

                                {/* Upload prompt for Express Onboarding */}
                                {currentTrack === 'FAST_TRACK' && hasGeneralLiability === true && (
                                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Upload className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-900">Upload proof of General Liability</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setCoiUploaded(true);
                                                    // TODO: Upload to Firebase Storage
                                                }
                                            }}
                                            className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white file:text-purple-700 hover:file:bg-purple-100"
                                        />
                                        {coiUploaded && (
                                            <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                <span>Uploaded</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Workers Comp */}
                            <div className={requiresWorkersComp ? 'p-4 bg-orange-50 border border-orange-200 rounded-lg' : ''}>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    Do you have Workers' Compensation insurance?
                                    {requiresWorkersComp && <span className="text-orange-600 ml-2">(Required in {vendorState})</span>}
                                    <span className="block text-xs text-slate-500 mt-1">¿Tiene seguro de compensación para trabajadores?</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHasWorkersComp(true)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasWorkersComp === true
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes / Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasWorkersComp(false)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasWorkersComp === false
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>

                                {/* Upload prompt for Express Onboarding */}
                                {currentTrack === 'FAST_TRACK' && hasWorkersComp === true && (
                                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Upload className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-900">Upload proof of Workers' Comp</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setW9Uploaded(true);
                                                    // TODO: Upload to Firebase Storage
                                                }
                                            }}
                                            className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white file:text-purple-700 hover:file:bg-purple-100"
                                        />
                                        {w9Uploaded && (
                                            <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                <span>Uploaded</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Commercial Auto */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    Do you have Commercial Auto insurance?
                                    <span className="block text-xs text-slate-500 mt-1">¿Tiene seguro de auto comercial?</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHasAutoInsurance(true)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasAutoInsurance === true
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        Yes / Sí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHasAutoInsurance(false)}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${hasAutoInsurance === false
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>

                                {/* Upload prompt for Express Onboarding */}
                                {currentTrack === 'FAST_TRACK' && hasAutoInsurance === true && (
                                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Upload className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-medium text-purple-900">Upload proof of Commercial Auto</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white file:text-purple-700 hover:file:bg-purple-100"
                                        />
                                    </div>
                                )}
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
                                                ? 'bg-emerald-600 text-white shadow-lg shadow-green-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes <span className="text-sm opacity-80">/ Sí</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasPollutionLiability(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${hasPollutionLiability === false
                                                ? 'bg-rose-600 text-white shadow-lg shadow-red-200'
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
