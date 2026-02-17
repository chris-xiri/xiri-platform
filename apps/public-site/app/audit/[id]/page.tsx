"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, MapPin, Calendar, CheckCircle, ArrowRight, ArrowLeft, Phone, Building2 } from "lucide-react";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { addDays, format, startOfHour, addHours } from 'date-fns';

// Steps
const STEPS = [
    { id: 'service', label: 'Service Needs' },
    { id: 'facility', label: 'Your Facility' },
    { id: 'schedule', label: 'Schedule Audit' },
    { id: 'contact', label: 'Contact Details' }
];

export default function AuditWizardPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [leadData, setLeadData] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(0);

    // Form State
    const [services, setServices] = useState<string[]>([]);
    const [facilityType, setFacilityType] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [address, setAddress] = useState<any>(null); // Google Maps Object
    const [manualAddress, setManualAddress] = useState("");
    const [auditSlots, setAuditSlots] = useState<string[]>([]);
    const [meetingType, setMeetingType] = useState('audit'); // 'audit' | 'intro'
    const [contact, setContact] = useState({ name: "", email: "", phone: "" });

    // Load Lead
    useEffect(() => {
        const load = async () => {
            if (!leadId) return;
            try {
                const snap = await getDoc(doc(db, "leads", leadId));
                if (snap.exists()) {
                    const data = snap.data();
                    setLeadData(data);
                    // Pre-fill
                    if (data.serviceInterest) setServices([data.serviceInterest]);
                    if (data.wizardStep) setCurrentStep(data.wizardStep - 1); // 1-based to 0-based
                } else {
                    router.replace("/");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [leadId, router]);

    const updateLead = async (updates: any, nextStep?: number) => {
        setSubmitting(true);
        try {
            const data = {
                ...updates,
                updatedAt: serverTimestamp(),
                wizardStep: (nextStep || currentStep) + 1
            };
            await updateDoc(doc(db, "leads", leadId), data);
            if (nextStep !== undefined) setCurrentStep(nextStep);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    // --- STEP COMPONENTS ---

    // Step 1: Services
    const StepServices = () => {
        const SERVICE_GROUPS = [
            {
                id: 'recurring',
                label: 'Recurring Services',
                services: [
                    {
                        id: 'janitorial',
                        label: 'Janitorial Cleaning',
                        description: 'Daily cleaning, trash removal, restroom maintenance',
                        frequency: '3-7x per week'
                    },
                    {
                        id: 'consumables',
                        label: 'Supplies & Consumables',
                        description: 'Paper products, soap, sanitizer, cleaning supplies',
                        frequency: 'Weekly restocking'
                    },
                    {
                        id: 'disinfecting',
                        label: 'Disinfection Services',
                        description: 'EPA-approved disinfection of high-touch surfaces',
                        frequency: 'Daily or weekly'
                    },
                ]
            },
            {
                id: 'periodic',
                label: 'Periodic Maintenance',
                services: [
                    {
                        id: 'floor_care',
                        label: 'Floor Care & Refinishing',
                        description: 'Strip, wax, and buffing for tile and VCT',
                        frequency: 'Monthly or quarterly'
                    },
                    {
                        id: 'landscaping',
                        label: 'Landscaping & Grounds',
                        description: 'Mowing, edging, mulching, seasonal plantings',
                        frequency: 'Bi-weekly or monthly'
                    },
                ]
            },
            {
                id: 'seasonal',
                label: 'Seasonal & On-Demand',
                services: [
                    {
                        id: 'snow_removal',
                        label: 'Snow & Ice Management',
                        description: 'Plowing, salting, walkway clearing',
                        frequency: 'Winter season'
                    },
                ]
            }
        ];

        const toggle = (id: string) => {
            if (services.includes(id)) setServices(services.filter(s => s !== id));
            else setServices([...services, id]);
        };

        return (
            <div className="space-y-8 animate-fadeIn">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Select the services you need</h2>
                    <p className="text-gray-600 mt-2">Check all that apply to your facility</p>
                </div>

                <div className="space-y-6">
                    {SERVICE_GROUPS.map((group) => (
                        <div key={group.id} className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{group.label}</h3>
                            <div className="space-y-2">
                                {group.services.map((service) => (
                                    <label
                                        key={service.id}
                                        className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={services.includes(service.id)}
                                            onChange={() => toggle(service.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-4">
                                                <span className="font-medium text-gray-900">{service.label}</span>
                                                <span className="text-sm text-gray-500 whitespace-nowrap">{service.frequency}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        {services.length === 0 ? 'No services selected' : `${services.length} service${services.length === 1 ? '' : 's'} selected`}
                    </p>
                    <button
                        onClick={() => updateLead({ services }, 1)}
                        disabled={services.length === 0 || submitting}
                        className="px-6 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                        {!submitting && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    };

    // Step 2: Facility
    const StepFacility = () => {
        const TYPES = [
            'Medical Office', 'Urgent Care', 'Surgery Center',
            'Auto Dealership', 'School / Daycare', 'Office Building', 'Other'
        ];

        return (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-gray-900">Tell us about the building.</h2>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Facility Type</label>
                    <select
                        value={facilityType}
                        onChange={(e) => setFacilityType(e.target.value)}
                        className="w-full p-4 rounded-xl border border-gray-200 bg-white"
                    >
                        <option value="">Select Type...</option>
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Company Name</label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Northwell Health"
                        className="w-full p-4 rounded-xl border border-gray-200"
                    />
                </div>
                <button
                    onClick={() => updateLead({ facilityType, businessName: companyName }, 2)}
                    disabled={!facilityType || !companyName || submitting}
                    className="btn-primary w-full"
                >
                    Next Step
                </button>
            </div>
        );
    };

    // Step 3: Location (Maps)
    const StepLocation = () => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

        return (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-gray-900">Where are you located?</h2>
                <p className="text-gray-500 text-sm">We need this to assign the correct regional manager.</p>

                {apiKey ? (
                    <div className="border border-gray-200 rounded-xl p-2">
                        <GooglePlacesAutocomplete
                            apiKey={apiKey}
                            selectProps={{
                                value: address,
                                onChange: setAddress,
                                placeholder: 'Start typing address...',
                            }}
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Full Address</label>
                        <input
                            type="text"
                            value={manualAddress}
                            onChange={(e) => setManualAddress(e.target.value)}
                            placeholder="123 Main St, New York, NY"
                            className="w-full p-4 rounded-xl border border-gray-200"
                        />
                        <p className="text-xs text-gray-400 mt-2">Enter address manually (Maps API Key missing).</p>
                    </div>
                )}

                <button
                    onClick={() => updateLead({ address: address ? address.label : manualAddress }, 3)}
                    disabled={(!address && !manualAddress) || submitting}
                    className="btn-primary w-full"
                >
                    Confirm Location
                </button>
            </div>
        );
    };

    // Step 4: Schedule
    const StepSchedule = () => {
        // Generate next 7 business days with time slots
        const generateSlots = () => {
            const slots = [];
            let current = addDays(new Date(), 1); // Start tomorrow
            let daysAdded = 0;

            while (daysAdded < 7) {
                const dayOfWeek = current.getDay();
                // Skip weekends (0 = Sunday, 6 = Saturday)
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const baseDate = startOfHour(current);
                    slots.push({
                        date: current,
                        times: [
                            { hour: 9, label: '9:00 AM', value: addHours(baseDate, 9) },
                            { hour: 13, label: '1:00 PM', value: addHours(baseDate, 13) },
                            { hour: 16, label: '4:00 PM', value: addHours(baseDate, 16) },
                        ]
                    });
                    daysAdded++;
                }
                current = addDays(current, 1);
            }
            return slots;
        };

        return (
            <div className="space-y-6 animate-fadeIn">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Select a Date & Time</h2>
                    <p className="text-gray-600 mt-2">
                        {meetingType === 'audit'
                            ? 'Choose a time for your 1-hour site walkthrough (Early/Late hours available)'
                            : 'Schedule a 30-min intro call to discuss your needs'}
                    </p>
                </div>

                {/* Meeting Type Toggle */}
                <div className="flex p-1 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => setMeetingType('audit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${meetingType === 'audit'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Site Walkthrough
                    </button>
                    <button
                        onClick={() => setMeetingType('intro')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${meetingType === 'intro'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Phone className="w-4 h-4" />
                        Intro Call
                    </button>
                </div>

                <div className="grid md:grid-cols-[200px_1fr] gap-6">
                    {/* Date Selector (Left Column) */}
                    <div className="space-y-2">
                        {(() => {
                            const dates = [];
                            let current = addDays(new Date(), 1);
                            let daysAdded = 0;
                            // Show next 5 business days
                            while (daysAdded < 5) {
                                const dayOfWeek = current.getDay();
                                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                    dates.push(new Date(current));
                                    daysAdded++;
                                }
                                current = addDays(current, 1);
                            }
                            return dates;
                        })().map((date, idx) => {
                            const isSelected = auditSlots.length > 0 &&
                                format(new Date(auditSlots[0]), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                            const isTomorrow = format(date, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd');

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const baseDate = startOfHour(date);
                                        // Default to 9am when selecting a new date
                                        const firstSlot = addHours(baseDate, 9);
                                        setAuditSlots([firstSlot.toISOString()]);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${isSelected
                                        ? 'border-sky-600 bg-sky-50 text-sky-900'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <div className={`text-xs font-medium ${isSelected ? 'text-sky-600' : 'text-gray-500'}`}>
                                        {format(date, 'EEE')}
                                    </div>
                                    <div className={`text-lg font-semibold ${isSelected ? 'text-sky-900' : 'text-gray-900'}`}>
                                        {format(date, 'd')}
                                    </div>
                                    {isTomorrow && (
                                        <div className="text-xs text-sky-600 font-medium mt-0.5">Tomorrow</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Time Slots (Right Column) */}
                    <div>
                        {auditSlots.length > 0 ? (
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-gray-700 mb-3">
                                    {format(new Date(auditSlots[0]), 'EEEE, MMMM d')}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {(() => {
                                        const selectedDate = new Date(auditSlots[0]);
                                        const baseDate = startOfHour(selectedDate);
                                        // Extended hours: 7am to 6pm
                                        const times = [
                                            { label: '7:00am', value: addHours(baseDate, 7) },
                                            { label: '8:00am', value: addHours(baseDate, 8) },
                                            { label: '9:00am', value: addHours(baseDate, 9) },
                                            { label: '10:00am', value: addHours(baseDate, 10) },
                                            { label: '11:00am', value: addHours(baseDate, 11) },
                                            { label: '12:00pm', value: addHours(baseDate, 12) },
                                            { label: '1:00pm', value: addHours(baseDate, 13) },
                                            { label: '2:00pm', value: addHours(baseDate, 14) },
                                            { label: '3:00pm', value: addHours(baseDate, 15) },
                                            { label: '4:00pm', value: addHours(baseDate, 16) },
                                            { label: '5:00pm', value: addHours(baseDate, 17) },
                                            { label: '6:00pm', value: addHours(baseDate, 18) },
                                        ];

                                        return times.map((timeSlot, timeIndex) => {
                                            const str = timeSlot.value.toISOString();
                                            const selected = auditSlots.includes(str);
                                            const now = new Date();
                                            const isPast = timeSlot.value < now;

                                            return (
                                                <button
                                                    key={timeIndex}
                                                    onClick={() => setAuditSlots([str])}
                                                    disabled={isPast}
                                                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${selected
                                                        ? 'bg-sky-600 text-white border-sky-600'
                                                        : 'bg-white border-gray-200 hover:border-sky-300 hover:bg-sky-50'
                                                        } ${isPast ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                >
                                                    {timeSlot.label}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 text-center">
                                Select a date to see available times.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        {auditSlots.length === 0 ? 'No time selected' : `Selected: ${format(new Date(auditSlots[0]), 'MMM d, h:mm a')}`}
                    </p>
                    <button
                        onClick={() => updateLead({ preferredAuditTimes: auditSlots, meetingType }, 4)}
                        disabled={auditSlots.length === 0 || submitting}
                        className="px-6 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                        {!submitting && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    };

    // Step 5: Contact
    const StepContact = () => {
        return (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-gray-900">Who should we contact?</h2>
                <div className="space-y-4">
                    <input
                        type="text" placeholder="Full Name"
                        value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-200"
                    />
                    <input
                        type="email" placeholder="Email Address"
                        value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-200"
                    />
                    <input
                        type="tel" placeholder="Phone Number"
                        value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-200"
                    />
                </div>
                <button
                    onClick={() => updateLead({ ...contact, contactName: contact.name, contactPhone: contact.phone, status: 'new' }, 5)}
                    disabled={!contact.name || !contact.email || submitting}
                    className="btn-primary w-full"
                >
                    Submit Request
                </button>
            </div>
        )
    }

    // Step 6: Success
    const StepSuccess = () => (
        <div className="text-center py-10 animate-fadeIn">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Request Received!</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-sm mx-auto">
                We have received your audit request for <strong>{companyName}</strong>.
                A Facility Solutions Manager will confirm your time shortly.
            </p>
            <button
                onClick={() => router.push("/")}
                className="text-sky-600 font-bold hover:underline"
            >
                Return Home
            </button>
        </div>
    );


    // Render current step - memoized to prevent input focus loss
    const renderStep = () => {
        switch (currentStep) {
            case 0: return <StepServices />;
            case 1: return <StepFacility />;
            case 2: return <StepLocation />;
            case 3: return <StepSchedule />;
            case 4: return <StepContact />;
            case 5: return <StepSuccess />;
            default: return null;
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                {/* Progress Bar */}
                {currentStep < 5 && (
                    <div className="mb-8">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-sky-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / 5) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                            {STEPS.map((step, i) => (
                                <span key={step.id} className={i === currentStep ? 'text-sky-600 font-bold' : ''}>
                                    {step.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="bg-white rounded-2xl shadow-sm p-8">

                    {/* STEP 0: Services */}
                    {currentStep === 0 && (
                        <div className="space-y-8 animate-fadeIn">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Select the services you need</h2>
                                <p className="text-gray-600 mt-2">Check all that apply to your facility</p>
                            </div>

                            <div className="space-y-6">
                                {[
                                    {
                                        id: 'recurring',
                                        label: 'Recurring Services',
                                        services: [
                                            {
                                                id: 'janitorial',
                                                label: 'Janitorial Cleaning',
                                                description: 'Daily cleaning, trash removal, restroom maintenance',
                                                frequency: '3-7x per week'
                                            },
                                            {
                                                id: 'consumables',
                                                label: 'Supplies & Consumables',
                                                description: 'Paper products, soap, sanitizer, cleaning supplies',
                                                frequency: 'Weekly restocking'
                                            },
                                            {
                                                id: 'disinfecting',
                                                label: 'Disinfection Services',
                                                description: 'EPA-approved disinfection of high-touch surfaces',
                                                frequency: 'Daily or weekly'
                                            },
                                        ]
                                    },
                                    {
                                        id: 'periodic',
                                        label: 'Periodic Maintenance',
                                        services: [
                                            {
                                                id: 'floor_care',
                                                label: 'Floor Care & Refinishing',
                                                description: 'Strip, wax, and buffing for tile and VCT',
                                                frequency: 'Monthly or quarterly'
                                            },
                                            {
                                                id: 'landscaping',
                                                label: 'Landscaping & Grounds',
                                                description: 'Mowing, edging, mulching, seasonal plantings',
                                                frequency: 'Bi-weekly or monthly'
                                            },
                                        ]
                                    },
                                    {
                                        id: 'seasonal',
                                        label: 'Seasonal & On-Demand',
                                        services: [
                                            {
                                                id: 'snow_removal',
                                                label: 'Snow & Ice Management',
                                                description: 'Plowing, salting, walkway clearing',
                                                frequency: 'Winter season'
                                            },
                                        ]
                                    }
                                ].map((group) => (
                                    <div key={group.id} className="space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{group.label}</h3>
                                        <div className="space-y-2">
                                            {group.services.map((service) => (
                                                <label
                                                    key={service.id}
                                                    className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={services.includes(service.id)}
                                                        onChange={() => {
                                                            if (services.includes(service.id)) setServices(services.filter(s => s !== service.id));
                                                            else setServices([...services, service.id]);
                                                        }}
                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-4">
                                                            <span className="font-medium text-gray-900">{service.label}</span>
                                                            <span className="text-sm text-gray-500 whitespace-nowrap">{service.frequency}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600">
                                    {services.length === 0 ? 'No services selected' : `${services.length} service${services.length === 1 ? '' : 's'} selected`}
                                </p>
                                <button
                                    onClick={() => updateLead({ services }, 1)}
                                    disabled={services.length === 0 || submitting}
                                    className="px-6 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                                    {!submitting && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Facility & Location */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Tell us about your facility</h2>
                                <p className="text-gray-600 mt-2">We'll use this to assign the right team and schedule your audit</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g. Northwell Health"
                                    className="w-full p-4 rounded-xl border border-gray-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Facility Address</label>
                                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                                    <div className="border border-gray-200 rounded-xl p-2">
                                        <GooglePlacesAutocomplete
                                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                            selectProps={{
                                                value: address,
                                                onChange: setAddress,
                                                placeholder: 'Start typing address...',
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={manualAddress}
                                        onChange={(e) => setManualAddress(e.target.value)}
                                        placeholder="123 Main St, New York, NY"
                                        className="w-full p-4 rounded-xl border border-gray-200"
                                    />
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    onClick={() => setCurrentStep(0)}
                                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    onClick={() => updateLead({ businessName: companyName, address: address ? address.label : manualAddress }, 2)}
                                    disabled={!companyName || (!address && !manualAddress) || submitting}
                                    className="btn-primary w-full max-w-xs"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}


                    {/* STEP 2: Schedule */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Select a Date & Time</h2>
<<<<<<< HEAD
    <p className="text-gray-600 mt-2">
        {meetingType === 'audit'
            ? 'Choose a time for your 1-hour site walkthrough (Early/Late hours available)'
            : 'Schedule a 30-min intro call to discuss your needs'}
    </p>
                            </div >

        {/* Meeting Type Toggle */ }
        < div className = "flex p-1 bg-gray-100 rounded-lg" >
                                <button
                                    onClick={() => setMeetingType('audit')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${meetingType === 'audit'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Building2 className="w-4 h-4" />
                                    Site Walkthrough
                                </button>
                                <button
                                    onClick={() => setMeetingType('intro')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${meetingType === 'intro'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Phone className="w-4 h-4" />
                                    Intro Call
                                </button>
=======
                                <p className="text-gray-600 mt-2">Choose a time that works best for your site walkthrough</p>
>>>>>>> origin/develop
                            </div >

        <div className="grid md:grid-cols-[200px_1fr] gap-6">
            {/* Date Selector (Left Column) */}
            <div className="space-y-2">
                {(() => {
                    const dates = [];
                    let current = addDays(new Date(), 1);
                    let daysAdded = 0;
<<<<<<< HEAD
                    // Show next 5 business days
=======

>>>>>>> origin/develop
                    while (daysAdded < 5) {
                        const dayOfWeek = current.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            dates.push(new Date(current));
                            daysAdded++;
                        }
                        current = addDays(current, 1);
                    }
                    return dates;
                })().map((date, idx) => {
                    const isSelected = auditSlots.length > 0 &&
                        format(new Date(auditSlots[0]), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                    const isTomorrow = format(date, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd');

                    return (
                        <button
                            key={idx}
                            onClick={() => {
<<<<<<< HEAD
                                const baseDate = startOfHour(date);
                                // Default to 9am when selecting a new date
=======
                                                    // When clicking a date, select the first available time slot for that day
                                                    const baseDate = startOfHour(date);
>>>>>>> origin/develop
                                const firstSlot = addHours(baseDate, 9);
                                setAuditSlots([firstSlot.toISOString()]);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${isSelected
<<<<<<< HEAD
                                ? 'border-sky-600 bg-sky-50 text-sky-900'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
=======
                                                        ? 'border-sky-600 bg-sky-50 text-sky-900'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white'
>>>>>>> origin/develop
                                }`}
                        >
                            <div className={`text-xs font-medium ${isSelected ? 'text-sky-600' : 'text-gray-500'}`}>
                                {format(date, 'EEE')}
                            </div>
                            <div className={`text-lg font-semibold ${isSelected ? 'text-sky-900' : 'text-gray-900'}`}>
                                {format(date, 'd')}
                            </div>
                            {isTomorrow && (
                                <div className="text-xs text-sky-600 font-medium mt-0.5">Tomorrow</div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Time Slots (Right Column) */}
            <div>
                {auditSlots.length > 0 ? (
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700 mb-3">
                            {format(new Date(auditSlots[0]), 'EEEE, MMMM d')}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(() => {
                                const selectedDate = new Date(auditSlots[0]);
                                const baseDate = startOfHour(selectedDate);
<<<<<<< HEAD
                                // Extended hours: 7am to 6pm
                                const times = [
                                    { label: '7:00am', value: addHours(baseDate, 7) },
                                    { label: '8:00am', value: addHours(baseDate, 8) },
                                    { label: '9:00am', value: addHours(baseDate, 9) },
                                    { label: '10:00am', value: addHours(baseDate, 10) },
                                    { label: '11:00am', value: addHours(baseDate, 11) },
                                    { label: '12:00pm', value: addHours(baseDate, 12) },
=======
                                                    const times = [
                                                        { label: '9:00am', value: addHours(baseDate, 9) },
                                                        { label: '10:00am', value: addHours(baseDate, 10) },
                                                        { label: '11:00am', value: addHours(baseDate, 11) },
>>>>>>> origin/develop
                                    { label: '1:00pm', value: addHours(baseDate, 13) },
                                    { label: '2:00pm', value: addHours(baseDate, 14) },
                                    { label: '3:00pm', value: addHours(baseDate, 15) },
                                    { label: '4:00pm', value: addHours(baseDate, 16) },
<<<<<<< HEAD
                                    { label: '5:00pm', value: addHours(baseDate, 17) },
                                    { label: '6:00pm', value: addHours(baseDate, 18) },
=======
>>>>>>> origin/develop
                                ];
                                return times;
                            })().map((time, idx) => {
                                const str = time.value.toISOString();
                                const selected = auditSlots.includes(str);
<<<<<<< HEAD
                                const hour = time.value.getHours();
                                const isExtended = hour < 9 || hour > 17; // Visual cue for extended hours?
=======
>>>>>>> origin/develop

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setAuditSlots([str])}
                                        className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${selected
<<<<<<< HEAD
                                            ? 'border-sky-600 bg-sky-600 text-white'
                                            : 'border-gray-200 hover:border-sky-600 hover:text-sky-600 bg-white text-gray-700'
                                            } ${isExtended ? 'opacity-90' : ''}`}
                                    >
                                        {time.label}
                                        {isExtended && selected && <span className="text-[10px] ml-1 opacity-75 block leading-none">Extended</span>}
=======
                                                                    ? 'border-sky-600 bg-sky-600 text-white'
                                                                    : 'border-gray-200 hover:border-sky-600 hover:text-sky-600 bg-white text-gray-700'
                                                                }`}
                                                        >
                                                            {time.label}
>>>>>>> origin/develop
                                    </button>
                                );
                            })}
                        </div>
<<<<<<< HEAD
    <p className="text-xs text-center text-gray-400 mt-4">
        Need a time outside these hours? Call us at (555) 123-4567
    </p>
=======
>>>>>>> origin/develop
                                        </div >
                                    ) : (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a date to see available times
        </div>
    )
}
                                </div >
                            </div >

    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
            <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back
            </button>
            <p className="text-sm text-gray-600">
                {auditSlots.length === 0 ? 'No time selected' : '✓ Time selected'}
            </p>
        </div>
        <button
<<<<<<< HEAD
            onClick={() => updateLead({
                preferredAuditTimes: auditSlots,
                meetingType,
                meetingDuration: meetingType === 'audit' ? 60 : 30
            }, 3)}
=======
                                    onClick={() => updateLead({ preferredAuditTimes: auditSlots }, 3)}
>>>>>>> origin/develop
            disabled={auditSlots.length === 0 || submitting}
            className="px-6 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
        </button>
    </div>
                        </div >
                    )}

{/* STEP 3: Contact */ }
{
    currentStep === 3 && (
        <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900">Who should we contact?</h2>
            <div className="space-y-4">
                <input
                    type="text" placeholder="Full Name"
                    value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })}
                    className="w-full p-4 rounded-xl border border-gray-200"
                />
                <input
                    type="email" placeholder="Email Address"
                    value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })}
                    className="w-full p-4 rounded-xl border border-gray-200"
                />
                <input
                    type="tel" placeholder="Phone Number"
                    value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })}
                    className="w-full p-4 rounded-xl border border-gray-200"
                />
            </div>
            <div className="flex items-center justify-between pt-4">
                <button
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <button
                    onClick={() => updateLead({ ...contact, contactName: contact.name, contactPhone: contact.phone, status: 'new' }, 4)}
                    disabled={!contact.name || !contact.email || submitting}
                    className="btn-primary w-full max-w-xs"
                >
                    Submit Request
                </button>
            </div>
        </div>
    )
}

{/* STEP 4: Success */ }
{
    currentStep === 4 && (
        <div className="text-center py-10 animate-fadeIn">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Request Received!</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-sm mx-auto">
                We have received your audit request for <strong>{companyName}</strong>.
                A Facility Solutions Manager will confirm your time shortly.
            </p>
            <button
                onClick={() => router.push("/")}
                className="text-sky-600 font-bold hover:underline"
            >
                Return Home
            </button>
        </div>
    )
}
                </div >
            </div >

    {/* Inline Styles for Google Places Autocomplete */ }
    < style jsx global > {`
                .btn-primary {
                    @apply bg-sky-600 text-white font-bold py-4 rounded-xl hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-600/30 flex items-center justify-center gap-2;
                }
                .btn-primary:disabled {
                    @apply opacity-50 cursor-not-allowed shadow-none;
                }
            `}</style >
        </div >
    );
}
