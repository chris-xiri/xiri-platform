"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Vendor } from "@xiri/shared";
import { Loader2, CheckCircle, Upload, ChevronRight, ChevronLeft, Globe } from "lucide-react";
import { translations, t, type Language } from "./translations";

export default function OnboardingPage() {
    const params = useParams();
    const vendorId = params?.vendorId as string;

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Language Selection
    const [language, setLanguage] = useState<Language>('en');
    const [languageSelected, setLanguageSelected] = useState(false);

    // Multi-Step State (Step 0 = Language, Step 1-4 = Form)
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = 4; // Not counting language selector

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
                        <span className="text-sm font-medium text-slate-700">
                            {t('progress.stepOf', language, { current: currentStep.toString(), total: effectiveSteps.toString() })}
                        </span>
                        <span className="text-sm text-slate-500">
                            {t('progress.complete', language, { percent: Math.round(effectiveProgress).toString() })}
                        </span>
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
                    {/* STEP 0: Language Selection */}
                    {currentStep === 0 && (
                        <div className="space-y-8 text-center">
                            <div>
                                <Globe className="w-16 h-16 mx-auto mb-4 text-sky-600" />
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                    {translations.en.languageSelector.title}
                                </h1>
                                <p className="text-slate-600">
                                    {translations.en.languageSelector.subtitle}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLanguage('en');
                                        setLanguageSelected(true);
                                        setCurrentStep(1);
                                    }}
                                    className="p-6 border-2 border-slate-200 rounded-lg hover:border-sky-600 hover:bg-sky-50 transition-all group"
                                >
                                    <div className="text-4xl mb-2">🇺🇸</div>
                                    <div className="font-semibold text-slate-900 group-hover:text-sky-600">
                                        {translations.en.languageSelector.english}
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setLanguage('es');
                                        setLanguageSelected(true);
                                        setCurrentStep(1);
                                    }}
                                    className="p-6 border-2 border-slate-200 rounded-lg hover:border-sky-600 hover:bg-sky-50 transition-all group"
                                >
                                    <div className="text-4xl mb-2">🇪🇸</div>
                                    <div className="font-semibold text-slate-900 group-hover:text-sky-600">
                                        {translations.es.languageSelector.spanish}
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Track Selection */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('step1.title', language)}</h2>
                                <p className="text-slate-600">{t('step1.subtitle', language)}</p>
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
                                            <div className="font-semibold text-slate-900 text-lg mb-1">{t('step1.network.title', language)}</div>
                                            <div className="text-sm text-slate-600">{t('step1.network.subtitle', language)}</div>
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
                                            <div className="font-semibold text-slate-900 text-lg mb-1">{t('step1.express.title', language)}</div>
                                            <div className="text-sm text-slate-600">{t('step1.express.subtitle', language)}</div>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Back to Language Selector */}
                            <div className="flex justify-start">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(0)}
                                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    {t('common.back', language)}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Qualification */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('step2.title', language)}</h2>
                                <p className="text-slate-600">{t('step2.subtitle', language)}</p>
                            </div>

                            <div className="space-y-5">
                                {/* Business Entity */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        {t('step2.businessEntity.question', language)}
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
                                            {t('common.yes', language)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasBusinessEntity(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasBusinessEntity === false
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {t('common.no', language)}
                                        </button>
                                    </div>

                                    {/* Business Name Input */}
                                    {hasBusinessEntity === true && (
                                        <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                                            <label className="block text-sm font-medium text-slate-900 mb-2">
                                                {t('step2.businessEntity.businessNameLabel', language)}
                                            </label>
                                            <input
                                                type="text"
                                                value={businessName}
                                                onChange={(e) => setBusinessName(e.target.value)}
                                                placeholder={t('step2.businessEntity.businessNamePlaceholder', language)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* General Liability */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        {t('step2.generalLiability.question', language)}
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
                                            {t('common.yes', language)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasGeneralLiability(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasGeneralLiability === false
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {t('common.no', language)}
                                        </button>
                                    </div>
                                </div>

                                {/* Workers' Comp */}
                                <div className={requiresWorkersComp ? 'p-4 bg-orange-50 border border-orange-200 rounded-lg' : ''}>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        {t('step2.workersComp.question', language)}
                                        {requiresWorkersComp && <span className="text-orange-600 ml-2">({t('step2.workersComp.requiredIn', language, { state: vendorState })})</span>}
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
                                            {t('common.yes', language)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasWorkersComp(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasWorkersComp === false
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {t('common.no', language)}
                                        </button>
                                    </div>
                                </div>

                                {/* Commercial Auto */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-900 mb-2">
                                        {t('step2.commercialAuto.question', language)}
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
                                            {t('common.yes', language)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHasAutoInsurance(false)}
                                            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${hasAutoInsurance === false
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {t('common.no', language)}
                                        </button>
                                    </div>
                                </div>

                                {/* Pollution Liability (Medical only) */}
                                {requiresPollution && (
                                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
                                        <label className="block text-sm font-medium text-sky-900 mb-2">
                                            {t('step2.pollutionLiability.question', language)}
                                            <span className="text-sky-700 ml-2">({t('step2.pollutionLiability.requiredFor', language)})</span>
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
                                                    ? 'bg-orange-600 text-white'
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
                                    {t('step2.validation.answerAll', language)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Contact Information */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('step3.title', language)}</h2>
                                <p className="text-slate-600">{t('step3.subtitle', language)}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        {t('step3.email.label', language)}
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('step3.email.placeholder', language)}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        {t('step3.phone.label', language)}
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        placeholder={t('step3.phone.placeholder', language)}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {!isStep3Valid() && email && phone && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    {t('step3.validation.invalidEmail', language)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Documents (Express Only) */}
                    {currentStep === 4 && currentTrack === 'FAST_TRACK' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('step4.title', language)}</h2>
                                <p className="text-slate-600">{t('step4.subtitle', language)}</p>
                            </div>

                            <div className="space-y-4">
                                {/* COI Upload */}
                                <div className="p-4 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-sky-700" />
                                        <span className="text-sm font-medium text-sky-900">{t('step4.coi.label', language)}</span>
                                        <span className="text-xs text-red-600">*{t('common.required', language)}</span>
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
                                            <span>{t('step4.uploaded', language)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* LLC Certificate Upload */}
                                <div className="p-4 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-sky-700" />
                                        <span className="text-sm font-medium text-sky-900">{t('step4.llc.label', language)}</span>
                                        <span className="text-xs text-red-600">*{t('common.required', language)}</span>
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
                                            <span>{t('step4.uploaded', language)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* W-9 Upload (Optional) */}
                                <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Upload className="w-5 h-5 text-slate-600" />
                                        <span className="text-sm font-medium text-slate-900">{t('step4.w9.label', language)}</span>
                                        <span className="text-xs text-slate-500">{t('common.optional', language)}</span>
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
                                            <span>{t('step4.uploaded', language)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isStep4Valid() && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    {t('step4.validation.uploadRequired', language)}
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
                                {t('common.back', language)}
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
                                {t('common.continue', language)}
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
                                {submitting ? t('common.loading', language) : t('common.submit', language)}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
