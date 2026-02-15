"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Vendor } from "@xiri/shared";
import { Loader2, CheckCircle, Upload, ChevronRight, ChevronLeft } from "lucide-react";

export default function OnboardingPage() {
    const params = useParams();
    const vendorId = params?.vendorId as string;

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Multi-Step State
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4;

    // Track Selection
    const searchParams = useSearchParams();
    const initialTrack = (searchParams?.get('track')?.toUpperCase() || 'STANDARD') as 'STANDARD' | 'FAST_TRACK';
    const [currentTrack, setCurrentTrack] = useState<'STANDARD' | 'FAST_TRACK'>(initialTrack);

    // Form State - Step 2: Qualification
    const [hasBusinessEntity, setHasBusinessEntity] = useState<boolean | null>(null);
    const [businessName, setBusinessName] = useState('');
    const [hasGeneralLiability, setHasGeneralLiability] = useState<boolean | null>(null);
    const [hasWorkersComp, setHasWorkersComp] = useState<boolean | null>(null);
    const [hasAutoInsurance, setHasAutoInsurance] = useState<boolean | null>(null);
    const [hasPollutionLiability, setHasPollutionLiability] = useState<boolean | null>(null);

    // Form State - Step 3: Contact Info
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Form State - Step 4: File Uploads
    const [coiUploaded, setCoiUploaded] = useState(false);
    const [llcUploaded, setLlcUploaded] = useState(false);
    const [w9Uploaded, setW9Uploaded] = useState(false);

    // State-based requirements
    const vendorState = vendor?.state || 'NY';
    const requiresWorkersComp = vendorState !== 'TX';
    const requiresPollution = vendor?.capabilities?.includes('medical');

    useEffect(() => {
        if (!vendorId) return;

        const unsubscribe = onSnapshot(doc(db, "vendors", vendorId), (doc) => {
            if (doc.exists()) {
                const vendorData = { id: doc.id, ...doc.data() } as Vendor;
                setVendor(vendorData);
                setEmail(vendorData.email || '');
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

    const formatPhoneNumber = (value: string) => {
        const phoneNumber = value.replace(/\D/g, '');
        if (phoneNumber.length <= 3) {
            return phoneNumber;
        } else if (phoneNumber.length <= 6) {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        } else {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    // Step Validation
    const isStep1Valid = () => currentTrack !== null;
    const isStep2Valid = () => {
        if (hasBusinessEntity === null || hasGeneralLiability === null) return false;
        if (hasBusinessEntity && !businessName.trim()) return false;
        if (hasWorkersComp === null) return false;
        if (hasAutoInsurance === null) return false;
        if (requiresPollution && hasPollutionLiability === null) return false;
        return true;
    };
    const isStep3Valid = () => {
        if (!email.trim() || !phone.trim()) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) return false;
        return true;
    };
    const isStep4Valid = () => {
        if (currentTrack === 'STANDARD') return true; // Skip for Partner Network
        return coiUploaded && llcUploaded; // W-9 is optional
    };

    const handleNext = () => {
        // Skip Step 4 for Partner Network
        if (currentStep === 3 && currentTrack === 'STANDARD') {
            handleSubmit();
        } else if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
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

            if (requiresPollution) {
                complianceData.additionalInsurance = [{
                    type: 'Pollution Liability',
                    hasInsurance: hasPollutionLiability,
                    verified: false
                }];
            }

            await updateDoc(doc(db, "vendors", vendor.id!), {
                businessName: businessName || vendor.businessName,
                email,
                phone,
                status: 'compliance_review',
                onboardingTrack: currentTrack,
                compliance: complianceData,
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
                        {currentTrack === "FAST_TRACK"
                            ? "Our compliance team is reviewing your documents. Expect a call within 24 hours."
                            : "You have been added to the Xiri Supply Network. We will contact you when jobs match your profile."}
                    </p>
                </div>
            </div>
        );
    }

    // Calculate progress
    const progress = (currentStep / totalSteps) * 100;
    const effectiveSteps = currentTrack === 'STANDARD' ? 3 : 4; // Partner Network skips Step 4
    const effectiveProgress = (currentStep / effectiveSteps) * 100;

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-sky-900 text-white py-8 px-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-bold">Join the Xiri Partner Network</h1>
                    <p className="text-sky-200 mt-2">Complete your profile to start receiving opportunities</p>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-2xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">Step {currentStep} of {effectiveSteps}</span>
                        <span className="text-sm text-slate-500">{Math.round(effectiveProgress)}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${effectiveProgress}%` }}
                        />
                    </div>
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-6 py-12">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    {/* STEP 1: Track Selection */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">What brings you here?</h2>
                                <p className="text-slate-600">Choose the option that best describes your situation</p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setCurrentTrack('STANDARD')}
                                    className={`w-full p-5 rounded-lg text-left transition-all border-2 ${currentTrack === 'STANDARD'
                                        ? 'bg-sky-50 border-sky-600 shadow-md'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${currentTrack === 'STANDARD' ? 'border-sky-600' : 'border-slate-300'
                                            }`}>
                                            {currentTrack === 'STANDARD' && <div className="w-3.5 h-3.5 rounded-full bg-sky-600" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-slate-900 text-lg mb-1">Join Our Network</div>
                                            <div className="text-sm text-slate-600">We'll actively find work that matches your services</div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCurrentTrack('FAST_TRACK')}
                                    className={`w-full p-5 rounded-lg text-left transition-all border-2 ${currentTrack === 'FAST_TRACK'
                                        ? 'bg-sky-50 border-sky-600 shadow-md'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${currentTrack === 'FAST_TRACK' ? 'border-sky-600' : 'border-slate-300'
                                            }`}>
                                            {currentTrack === 'FAST_TRACK' && <div className="w-3.5 h-3.5 rounded-full bg-sky-600" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-slate-900 text-lg mb-1">I Need Work Now</div>
                                            <div className="text-sm text-slate-600">Jobs ready - just need your paperwork</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Qualification */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">Quick Qualification</h2>
                                <p className="text-slate-600">Just a few Yes/No questions</p>
                            </div>

                            <div className="space-y-5">
                                {/* Business Entity */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        Do you have a registered business entity (LLC/Corp)?
                                        <span className="block text-xs text-slate-500 mt-0.5">¿Tiene una entidad comercial registrada?</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHasBusinessEntity(true)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasBusinessEntity === true
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes / Sí
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasBusinessEntity(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasBusinessEntity === false
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            No
                                        </button>
                                    </div>

                                    {/* Business Name Input */}
                                    {hasBusinessEntity === true && (
                                        <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                                            <label className="block text-sm font-medium text-slate-900 mb-2">
                                                What's your business name?
                                                <span className="block text-xs text-slate-500 mt-0.5">¿Cuál es el nombre de su negocio?</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={businessName}
                                                onChange={(e) => setBusinessName(e.target.value)}
                                                placeholder="e.g., ABC Cleaning Services LLC"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* General Liability */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        Do you have General Liability insurance?
                                        <span className="block text-xs text-slate-500 mt-0.5">¿Tiene seguro de responsabilidad general?</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHasGeneralLiability(true)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasGeneralLiability === true
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes / Sí
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasGeneralLiability(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasGeneralLiability === false
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>

                                {/* Workers' Comp */}
                                <div className={requiresWorkersComp ? 'p-4 bg-orange-50 border border-orange-200 rounded-lg' : ''}>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        Do you have Workers' Compensation insurance?
                                        {requiresWorkersComp && <span className="text-orange-600 ml-2">(Required in {vendorState})</span>}
                                        <span className="block text-xs text-slate-500 mt-0.5">¿Tiene seguro de compensación para trabajadores?</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHasWorkersComp(true)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasWorkersComp === true
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes / Sí
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasWorkersComp(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasWorkersComp === false
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>

                                {/* Commercial Auto */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        Do you have Commercial Auto insurance?
                                        <span className="block text-xs text-slate-500 mt-0.5">¿Tiene seguro de auto comercial?</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHasAutoInsurance(true)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasAutoInsurance === true
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            Yes / Sí
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasAutoInsurance(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasAutoInsurance === false
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>

                                {/* Pollution Liability (Medical only) */}
                                {requiresPollution && (
                                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
                                        <label className="block text-sm font-medium text-sky-900 mb-2">
                                            Do you have Pollution Liability insurance?
                                            <span className="text-sky-700 ml-2">(Required for medical facilities)</span>
                                            <span className="block text-xs text-sky-700 mt-0.5">¿Tiene seguro de responsabilidad por contaminación?</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setHasPollutionLiability(true)}
                                                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasPollutionLiability === true
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                                    }`}
                                            >
                                                Yes / Sí
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHasPollutionLiability(false)}
                                                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasPollutionLiability === false
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                                    }`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!isStep2Valid() && hasBusinessEntity !== null && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    ✓ Please answer all questions to continue
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Contact Information */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">✓ Great! You're qualified</h2>
                                <p className="text-slate-600">How can we reach you?</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Primary Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        placeholder="(555) 123-4567"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {!isStep3Valid() && email && phone && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    Please enter a valid email and 10-digit phone number
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Documents (Express Only) */}
                    {currentStep === 4 && currentTrack === 'FAST_TRACK' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">✓ Almost there!</h2>
                                <p className="text-slate-600">Upload your documents to complete your application</p>
                            </div>

                            <div className="space-y-4">
                                {/* COI Upload */}
                                <div className="p-4 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-sky-700" />
                                        <span className="text-sm font-medium text-sky-900">Certificate of Insurance (COI)</span>
                                        <span className="text-xs text-red-600">*Required</span>
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
                                        className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sky-600 file:text-white hover:file:bg-sky-700 file:cursor-pointer"
                                    />
                                    {coiUploaded && (
                                        <div className="flex items-center gap-1 mt-2 text-sm text-green-700">
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Uploaded successfully</span>
                                        </div>
                                    )}
                                </div>

                                {/* LLC Certificate Upload */}
                                <div className="p-4 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-sky-700" />
                                        <span className="text-sm font-medium text-sky-900">Business License / LLC Certificate</span>
                                        <span className="text-xs text-red-600">*Required</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                setLlcUploaded(true);
                                                // TODO: Upload to Firebase Storage
                                            }
                                        }}
                                        className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sky-600 file:text-white hover:file:bg-sky-700 file:cursor-pointer"
                                    />
                                    {llcUploaded && (
                                        <div className="flex items-center gap-1 mt-2 text-sm text-green-700">
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Uploaded successfully</span>
                                        </div>
                                    )}
                                </div>

                                {/* W-9 Upload (Optional) */}
                                <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-slate-600" />
                                        <span className="text-sm font-medium text-slate-900">W-9 Form</span>
                                        <span className="text-xs text-slate-500">Optional</span>
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
                                        className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-600 file:text-white hover:file:bg-slate-700 file:cursor-pointer"
                                    />
                                    {w9Uploaded && (
                                        <div className="flex items-center gap-1 mt-2 text-sm text-green-700">
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Uploaded successfully</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isStep4Valid() && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    Please upload COI and Business License to continue
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
                        {currentStep > 1 ? (
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Back
                            </button>
                        ) : (
                            <div />
                        )}

                        {currentStep < totalSteps && !(currentStep === 3 && currentTrack === 'STANDARD') ? (
                            <button
                                onClick={handleNext}
                                disabled={
                                    (currentStep === 1 && !isStep1Valid()) ||
                                    (currentStep === 2 && !isStep2Valid()) ||
                                    (currentStep === 3 && !isStep3Valid()) ||
                                    (currentStep === 4 && !isStep4Valid())
                                }
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${(currentStep === 1 && isStep1Valid()) ||
                                    (currentStep === 2 && isStep2Valid()) ||
                                    (currentStep === 3 && isStep3Valid()) ||
                                    (currentStep === 4 && isStep4Valid())
                                    ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg hover:shadow-xl'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                Continue
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || (currentStep === 4 && !isStep4Valid())}
                                className={`px-8 py-3 rounded-lg font-bold transition-all ${submitting || (currentStep === 4 && !isStep4Valid())
                                    ? 'bg-slate-400 text-white cursor-not-allowed'
                                    : 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {submitting ? 'Submitting...' : 'Complete Application'}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
