"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Loader2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { trackEvent } from "@/lib/tracking";

const STEPS = [
    { id: "service", label: "Service Needs" },
    { id: "facility", label: "Your Facility" },
    { id: "contact", label: "Contact Details" },
    { id: "schedule", label: "Book Walkthrough" },
];

const SERVICE_GROUPS = [
    {
        id: "recurring",
        label: "Recurring Services",
        services: [
            {
                id: "janitorial",
                label: "Janitorial Cleaning",
                description: "Daily cleaning, trash removal, restroom maintenance",
                frequency: "3-7x per week",
            },
            {
                id: "consumables",
                label: "Supplies & Consumables",
                description: "Paper products, soap, sanitizer, cleaning supplies",
                frequency: "Weekly restocking",
            },
            {
                id: "disinfecting",
                label: "Disinfection Services",
                description: "EPA-approved disinfection of high-touch surfaces",
                frequency: "Daily or weekly",
            },
        ],
    },
    {
        id: "periodic",
        label: "Periodic Maintenance",
        services: [
            {
                id: "floor_care",
                label: "Floor Care & Refinishing",
                description: "Strip, wax, and buffing for tile and VCT",
                frequency: "Monthly or quarterly",
            },
            {
                id: "landscaping",
                label: "Landscaping & Grounds",
                description: "Mowing, edging, mulching, seasonal plantings",
                frequency: "Bi-weekly or monthly",
            },
        ],
    },
    {
        id: "seasonal",
        label: "Seasonal & On-Demand",
        services: [
            {
                id: "snow_removal",
                label: "Snow & Ice Management",
                description: "Plowing, salting, walkway clearing",
                frequency: "Winter season",
            },
        ],
    },
];

interface AuditLeadPayload {
    serviceInterest?: string | null;
    services?: string[] | null;
    facilityType?: string;
    businessName?: string;
    squareFootage?: number | null;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    contactRole?: string;
    wizardStep?: number;
}

const PRIMARY_BTN =
    "bg-sky-600 text-white font-bold py-4 px-6 rounded-xl hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";

export default function AuditWizardPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [currentStep, setCurrentStep] = useState(0);

    // Form State
    const [services, setServices] = useState<string[]>([]);
    const [companyName, setCompanyName] = useState("");
    const [squareFootage, setSquareFootage] = useState("");
    const [address, setAddress] = useState("");
    const [contact, setContact] = useState({ name: "", phone: "", role: "Facility Manager" });

    // Load Lead via Cloud Function (keeps `leads`/`companies` locked down in Firestore rules)
    useEffect(() => {
        const load = async () => {
            if (!leadId) {
                router.replace("/");
                return;
            }
            try {
                const getAuditLeadFn = httpsCallable<{ leadId: string }, { exists: boolean; lead?: AuditLeadPayload }>(
                    functions,
                    "getAuditLead"
                );
                const result = await getAuditLeadFn({ leadId });
                if (result.data?.exists && result.data.lead) {
                    const data = result.data.lead;
                    if (Array.isArray(data.services) && data.services.length > 0) {
                        setServices(data.services);
                    } else if (data.serviceInterest && data.serviceInterest !== "general") {
                        setServices([data.serviceInterest]);
                    }
                    if (data.businessName) setCompanyName(data.businessName);
                    if (data.squareFootage) setSquareFootage(String(data.squareFootage));
                    if (data.address) setAddress(data.address);
                    if (data.contactName || data.contactPhone || data.contactRole) {
                        setContact({
                            name: data.contactName || "",
                            phone: data.contactPhone || "",
                            role: data.contactRole || "Facility Manager",
                        });
                    }
                    if (typeof data.wizardStep === "number" && data.wizardStep >= 1) {
                        setCurrentStep(Math.min(data.wizardStep - 1, 4));
                    }
                } else {
                    router.replace("/");
                }
            } catch (err) {
                console.error("Failed to load audit lead:", err);
                setError("We couldn't load your audit session. Please refresh or call us at (516) 399-0350.");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [leadId, router]);

    const updateLead = async (updates: Record<string, any>, nextStep?: number) => {
        setSubmitting(true);
        setError("");
        try {
            const wizardStep = (nextStep ?? currentStep) + 1;
            const updateAuditLeadFn = httpsCallable(functions, "updateAuditLead");
            await updateAuditLeadFn({ leadId, updates, wizardStep });

            const stepNames = ["service", "facility", "contact", "schedule", "submit"];
            const stepId = stepNames[currentStep] || `step_${currentStep}`;
            if (nextStep === 4) {
                trackEvent("audit_submit", { step_id: stepId, lead_id: leadId });
            } else {
                trackEvent("audit_step_complete", { step_id: stepId, next_step: String(nextStep ?? currentStep) });
            }
            if (nextStep !== undefined) setCurrentStep(nextStep);
        } catch (err) {
            console.error("Failed to update audit lead:", err);
            setError("Something went wrong saving your details. Please try again or call (516) 399-0350.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                {/* Progress Bar */}
                {currentStep < 4 && (
                    <div className="mb-8">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-sky-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                            {STEPS.map((step, i) => (
                                <span key={step.id} className={i === currentStep ? "text-sky-600 font-bold" : ""}>
                                    {step.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="bg-white rounded-2xl shadow-sm p-8">
                    {error && (
                        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}

                    {/* STEP 0: Services */}
                    {currentStep === 0 && (
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
                                                        onChange={() => {
                                                            if (services.includes(service.id)) setServices(services.filter((s) => s !== service.id));
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
                                    {services.length === 0 ? "No services selected" : `${services.length} service${services.length === 1 ? "" : "s"} selected`}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => updateLead({ services }, 1)}
                                    disabled={services.length === 0 || submitting}
                                    className="px-6 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Services"}
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
                                <p className="text-gray-600 mt-2">We&apos;ll use this to assign the right team and schedule your audit</p>
                            </div>

                            <div>
                                <label htmlFor="audit-company" className="block text-sm font-bold text-gray-700 mb-2">Company Name</label>
                                <input
                                    id="audit-company"
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g. Northwell Health"
                                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="audit-sqft" className="block text-sm font-bold text-gray-700 mb-2">Estimated Square Footage</label>
                                <input
                                    id="audit-sqft"
                                    type="number"
                                    value={squareFootage}
                                    onChange={(e) => setSquareFootage(e.target.value)}
                                    placeholder="e.g. 10000"
                                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="audit-address" className="block text-sm font-bold text-gray-700 mb-2">Facility Address</label>
                                <AddressAutocompleteInput
                                    id="audit-address"
                                    name="address"
                                    required
                                    value={address}
                                    onChange={setAddress}
                                    placeholder="Start typing address..."
                                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(0)}
                                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateLead(
                                            {
                                                businessName: companyName.trim(),
                                                address: address.trim(),
                                                squareFootage: squareFootage ? Number(squareFootage) : null,
                                            },
                                            2
                                        )
                                    }
                                    disabled={!companyName.trim() || !address.trim() || submitting}
                                    className={`${PRIMARY_BTN} w-full max-w-xs`}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Facility Details"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Contact */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                            <h2 className="text-2xl font-bold text-gray-900">Who should we contact?</h2>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={contact.name}
                                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                                <select
                                    value={contact.role}
                                    onChange={(e) => setContact({ ...contact, role: e.target.value })}
                                    className="w-full p-4 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-sky-500 outline-none"
                                >
                                    <option value="Facility Manager">Facility Manager</option>
                                    <option value="Property Manager">Property Manager</option>
                                    <option value="Operations Director">Operations Director</option>
                                    <option value="Office Manager">Office Manager</option>
                                    <option value="Owner">Owner / Principal</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={contact.phone}
                                    onChange={(e) => {
                                        const input = e.target.value.replace(/\D/g, "");
                                        let formatted = "";

                                        if (input.length > 0) {
                                            formatted = "(" + input.substring(0, 3);
                                            if (input.length >= 3) {
                                                formatted += ") " + input.substring(3, 6);
                                            }
                                            if (input.length >= 6) {
                                                formatted += "-" + input.substring(6, 10);
                                            }
                                        }

                                        setContact({ ...contact, phone: formatted });
                                    }}
                                    maxLength={14}
                                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center justify-between pt-4 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateLead(
                                            {
                                                name: contact.name.trim(),
                                                phone: contact.phone.trim(),
                                                role: contact.role,
                                                contactName: contact.name.trim(),
                                                contactPhone: contact.phone.trim(),
                                                contactRole: contact.role,
                                                status: "new",
                                            },
                                            3
                                        )
                                    }
                                    disabled={!contact.name.trim() || submitting}
                                    className={`${PRIMARY_BTN} w-full max-w-xs`}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "See Your Estimate & Schedule"}
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-400 font-medium">🔒 Your information is secure and no commitment is required.</p>
                        </div>
                    )}

                    {/* STEP 3: Book Walkthrough via TidyCal */}
                    {currentStep === 3 && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Book Your Site Walk-through</h2>
                                <p className="text-gray-600 mt-2">Pick a time that works best — we&apos;ll come to you.</p>
                            </div>

                            {/* TidyCal Embed — clip bottom to hide branding */}
                            <div className="rounded-xl overflow-hidden" style={{ marginBottom: "-40px" }}>
                                <iframe
                                    src={`https://tidycal.com/xiri-facility-solutions/walkthrough?name=${encodeURIComponent(contact.name || "")}`}
                                    width="100%"
                                    frameBorder="0"
                                    title="Book Site Walk-through"
                                    style={{ border: "none", height: "calc(100vh - 280px)", minHeight: "500px", marginBottom: "-50px" }}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(4)}
                                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    Skip for now →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Success */}
                    {currentStep === 4 && (
                        <div className="text-center py-10 animate-fadeIn">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                                <CheckCircle className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Request Received!</h2>
                            <p className="text-lg text-gray-600 mb-8 max-w-sm mx-auto">
                                We have received your audit request for <strong>{companyName || "your facility"}</strong>.
                                A Facility Solutions Manager will confirm your time shortly.
                            </p>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="text-sky-600 font-bold hover:underline"
                            >
                                Return Home
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
