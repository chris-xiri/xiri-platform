"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { Vendor } from "@xiri-facility-solutions/shared";
import { Loader2, CheckCircle, Upload, ChevronRight, ChevronLeft, Globe, Calendar, Clock, Phone, Video } from "lucide-react";
import { translations, t, type Language } from "./translations";
import { addDays, format } from "date-fns";
import { trackEvent } from "@/lib/tracking";

// Cloud Functions base URL
const CF_BASE = process.env.NEXT_PUBLIC_CF_BASE || "https://us-central1-xiri-facility-solutions.cloudfunctions.net";

export default function OnboardingPage() {
    const params = useParams();
    const vendorId = params?.vendorId as string;

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [callBooked, setCallBooked] = useState(false);
    const [selectedCallSlot, setSelectedCallSlot] = useState<string | null>(null);
    const [bookingCall, setBookingCall] = useState(false);
    const [meetingUrl, setMeetingUrl] = useState<string | null>(null);


    // Timezone
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [selectedTz, setSelectedTz] = useState(detectedTz);
    const [showTzDropdown, setShowTzDropdown] = useState(false);
    const commonTimezones = [
        { label: 'Eastern Time (ET)', value: 'America/New_York' },
        { label: 'Central Time (CT)', value: 'America/Chicago' },
        { label: 'Mountain Time (MT)', value: 'America/Denver' },
        { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    ];
    const tzLabel = commonTimezones.find(tz => tz.value === selectedTz)?.label || selectedTz;

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
    const [contactName, setContactName] = useState('');
    const [contactRole, setContactRole] = useState<'Owner' | 'Dispatch' | 'Billing' | 'Sales' | 'Other'>('Owner');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Form State - Step 4: ACORD 25 Upload
    const [acordFile, setAcordFile] = useState<File | null>(null);
    const [acordUploaded, setAcordUploaded] = useState(false);
    const [acordDownloadUrl, setAcordDownloadUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [step4Attempted, setStep4Attempted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                if (!contactName) setContactName(vendorData.contactName || '');
                if (!email) setEmail(vendorData.email || '');
                const rawPhone = vendorData.phone || '';
                const formattedPhone = rawPhone.replace(/\D/g, '');
                if (!phone) {
                    if (formattedPhone.length === 10) {
                        setPhone(`(${formattedPhone.slice(0, 3)}) ${formattedPhone.slice(3, 6)}-${formattedPhone.slice(6, 10)}`);
                    } else {
                        setPhone(rawPhone);
                    }
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    // Track onboarding start on mount
    useEffect(() => {
        if (vendorId) {
            trackEvent('onboarding_start', { vendor_id: vendorId });
        }
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
        if (!contactName.trim() || !email.trim() || !phone.trim()) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) return false;
        return true;
    };
    const isStep4Valid = () => {
        if (currentTrack === 'STANDARD') return true; // Skip for Partner Network
        return acordUploaded; // ACORD 25 uploaded
    };

    const handleAcord25Upload = async (file: File) => {
        if (!vendor?.id) return;
        setAcordFile(file);
        setUploading(true);
        setUploadProgress(0);

        const storageRef = ref(storage, `acord25/${vendor.id}/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error('Upload error:', error);
                setUploading(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                setAcordDownloadUrl(downloadURL);
                setAcordUploaded(true);
                setUploading(false);

                // Save to vendor doc and trigger AI verification
                await updateDoc(doc(db, "vendors", vendor.id!), {
                    'compliance.acord25': {
                        status: 'PENDING',
                        url: downloadURL,
                        uploadedAt: serverTimestamp()
                    },
                    updatedAt: serverTimestamp()
                });
            }
        );
    };

    const handleNext = async () => {
        // Validate current step before allowing advancement
        if (currentStep === 1 && !isStep1Valid()) return;
        if (currentStep === 2 && !isStep2Valid()) return;
        if (currentStep === 3 && !isStep3Valid()) return;

        // Persist contact info when leaving Step 3 → Step 4 (FAST_TRACK)
        // This ensures contact data is saved before ACORD upload triggers verification
        if (currentStep === 3 && currentTrack === 'FAST_TRACK' && vendor?.id) {
            const nameParts = contactName.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            try {
                await updateDoc(doc(db, "vendors", vendor.id), {
                    contactName,
                    email,
                    phone,
                    businessName: businessName || vendor.businessName,
                    contacts: [{
                        id: crypto.randomUUID(),
                        firstName,
                        lastName,
                        role: contactRole,
                        phone,
                        email,
                        isPrimary: true,
                    }],
                    preferredLanguage: language,
                    updatedAt: serverTimestamp(),
                });
            } catch (error) {
                console.error("Error saving contact info:", error);
            }
        }

        // Skip Step 4 for Partner Network
        if (currentStep === 3 && currentTrack === 'STANDARD') {
            handleSubmit();
        } else if (currentStep === 4 && !isStep4Valid()) {
            setStep4Attempted(true);
        } else if (currentStep < totalSteps) {
            trackEvent('onboarding_step_complete', { step_number: String(currentStep), track: currentTrack, vendor_id: vendorId });
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
            // Merge compliance data — preserve existing fields like acord25
            const complianceUpdate: Record<string, any> = {
                'compliance.hasBusinessEntity': hasBusinessEntity,
                'compliance.generalLiability': {
                    hasInsurance: hasGeneralLiability,
                    verified: false
                },
                'compliance.workersComp': {
                    hasInsurance: hasWorkersComp,
                    verified: false
                },
                'compliance.autoInsurance': {
                    hasInsurance: hasAutoInsurance,
                    verified: false
                },
                'compliance.w9Collected': false,
            };

            if (requiresPollution) {
                complianceUpdate['compliance.additionalInsurance'] = [{
                    type: 'Pollution Liability',
                    hasInsurance: hasPollutionLiability,
                    verified: false
                }];
            }

            // Split contact name into first/last for CRM contact
            const nameParts = contactName.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Create primary contact entry for CRM
            const primaryContact = {
                id: crypto.randomUUID(),
                firstName,
                lastName,
                role: contactRole,
                phone,
                email,
                isPrimary: true,
            };

            await updateDoc(doc(db, "vendors", vendor.id!), {
                businessName: businessName || vendor.businessName,
                contactName,
                email,
                phone,
                contacts: arrayUnion(primaryContact),
                status: 'compliance_review',
                onboardingTrack: currentTrack,
                preferredLanguage: language, // Save 'en' or 'es'
                ...complianceUpdate,
                updatedAt: serverTimestamp()
            });

            setCompleted(true);
            trackEvent('onboarding_submit', { track: currentTrack, vendor_id: vendorId });
            trackEvent('onboarding_success', { track: currentTrack, vendor_id: vendorId });
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

    // Check if vendor qualifies for onboarding call (GL + LLC + WC)
    const qualifiesForCall = hasGeneralLiability && hasBusinessEntity && hasWorkersComp;

    if (completed) {
        // ─── Scheduling UI via TidyCal Embed (if qualified) ───
        if (qualifiesForCall) {
            return (
                <div className="min-h-screen bg-slate-50 p-4">
                    <div className="w-full max-w-5xl mx-auto">
                        {/* Success Banner */}
                        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Application Submitted!</h2>
                            <p className="text-slate-600 mt-1">You qualify for an onboarding call. Book a time below.</p>
                        </div>

                        {/* TidyCal Embed — clip bottom to hide branding */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ marginBottom: '-40px', paddingBottom: 0 }}>
                            <iframe
                                src={`https://tidycal.com/xiri-facility-solutions/xiri-contractors-30-minutes?name=${encodeURIComponent(contactName || '')}&email=${encodeURIComponent(email || '')}`}
                                width="100%"
                                frameBorder="0"
                                title="Schedule Onboarding Call"
                                style={{ border: 'none', height: 'calc(100vh - 160px)', minHeight: '600px', marginBottom: '-50px' }}
                            />
                        </div>

                        {/* Skip Option */}
                        <p className="text-center text-sm text-slate-500 mt-4">
                            Not ready to schedule? No worries — we&apos;ll reach out to you soon.
                        </p>
                    </div>
                </div>
            );
        }

        // ─── Simple Success (doesn't qualify for call) ───
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('success.title', language)}</h2>
                    <p className="text-slate-600">
                        {currentTrack === "FAST_TRACK"
                            ? t('success.express.message', language)
                            : t('success.network.message', language)}
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
            <header className="bg-sky-900 text-white py-4 md:py-8 px-4 md:px-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-bold">Join the XIRI Partner Network</h1>
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

            <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-12 pb-28 md:pb-12">
                <div className="bg-white rounded-xl shadow-lg p-4 md:p-8">
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
                                        trackEvent('onboarding_language', { language: 'en', vendor_id: vendorId });
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
                                        trackEvent('onboarding_language', { language: 'es', vendor_id: vendorId });
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
                                        Contact Name
                                    </label>
                                    <input
                                        type="text"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        placeholder="e.g. John Smith"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Your Role
                                    </label>
                                    <select
                                        value={contactRole}
                                        onChange={(e) => setContactRole(e.target.value as any)}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                                    >
                                        <option value="Owner">Owner / Principal</option>
                                        <option value="Dispatch">Dispatch / Ops Manager</option>
                                        <option value="Sales">Sales Rep</option>
                                        <option value="Billing">Billing / Accounting</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

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

                    {/* STEP 4: ACORD 25 Upload (Express Only) */}
                    {currentStep === 4 && currentTrack === 'FAST_TRACK' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('step4.title', language)}</h2>
                                <p className="text-slate-600">
                                    Upload your ACORD 25 (Certificate of Liability Insurance). We'll verify your coverage after submission.
                                </p>
                            </div>

                            {/* What is ACORD 25? */}
                            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-sky-900 mb-2">What is an ACORD 25?</h3>
                                <p className="text-sm text-sky-800">
                                    The ACORD 25 is a standard certificate issued by your insurance agent. It shows all your coverage
                                    (General Liability, Workers&apos; Comp, Auto, etc.) on a single document. Ask your insurance agent
                                    for a copy if you don&apos;t have one.
                                </p>
                            </div>

                            {/* Upload Zone */}
                            <div className="space-y-4">
                                <div className={`p-6 border-2 border-dashed rounded-lg text-center transition-all ${acordUploaded
                                    ? 'border-green-400 bg-green-50'
                                    : uploading
                                        ? 'border-sky-400 bg-sky-50'
                                        : 'border-sky-300 bg-sky-50 hover:border-sky-400'
                                    }`}>
                                    {acordUploaded ? (
                                        <div className="space-y-2">
                                            <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
                                            <p className="font-semibold text-green-800">ACORD 25 Uploaded</p>
                                            <p className="text-sm text-green-700">{acordFile?.name}</p>
                                            <p className="text-xs text-green-600">Your document will be reviewed after submission</p>
                                        </div>
                                    ) : uploading ? (
                                        <div className="space-y-3">
                                            <Upload className="w-10 h-10 text-sky-600 mx-auto animate-pulse" />
                                            <p className="font-medium text-sky-800">Uploading...</p>
                                            <div className="w-full max-w-xs mx-auto bg-sky-200 rounded-full h-2">
                                                <div
                                                    className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-sky-600">{Math.round(uploadProgress)}%</p>
                                        </div>
                                    ) : (
                                        <div
                                            className="space-y-3 cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                                        >
                                            <Upload className="w-10 h-10 text-sky-600 mx-auto" />
                                            <div>
                                                <p className="font-semibold text-sky-900">Tap to Upload ACORD 25</p>
                                                <p className="text-xs text-sky-700">Certificate of Liability Insurance</p>
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleAcord25Upload(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors">
                                                <Upload className="w-4 h-4" />
                                                Choose File
                                            </div>
                                            <p className="text-xs text-slate-500">PDF, JPG, or PNG • Max 10MB</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* What we verify */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-2">What we verify</h3>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    <li>✓ Business entity name matches your application</li>
                                    <li>✓ General Liability ≥ $1M per occurrence / $2M aggregate</li>
                                    <li>✓ Workers&apos; Compensation active policy</li>
                                    <li>✓ Policy expiration dates are current</li>
                                </ul>
                            </div>

                            {step4Attempted && !isStep4Valid() && !uploading && (
                                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    Please upload your ACORD 25 to continue.
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main>

            {/* Sticky Bottom Navigation — app-like */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    {currentStep > 1 ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 font-medium transition-colors"
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
                                (currentStep === 3 && !isStep3Valid())
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
                            onClick={() => {
                                if (currentStep === 4 && !isStep4Valid()) {
                                    setStep4Attempted(true);
                                    return;
                                }
                                handleSubmit();
                            }}
                            disabled={submitting}
                            className={`px-8 py-3 rounded-lg font-bold transition-all ${submitting
                                ? 'bg-slate-400 text-white cursor-not-allowed'
                                : 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg hover:shadow-xl'
                                }`}
                        >
                            {submitting ? t('common.loading', language) : t('common.submit', language)}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
