"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight, Building2, MapPin, Calendar, User } from "lucide-react";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { addDays, format, startOfHour, addHours } from 'date-fns';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

// Steps Configuration
const STEPS = [
    { id: 'service', label: 'Service Needs' },
    { id: 'facility', label: 'Facility Info' },
    { id: 'location', label: 'Location' },
    { id: 'schedule', label: 'Schedule Audit' },
    { id: 'contact', label: 'Contact Details' }
];

export default function ClientAuditPage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as string;
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Form State
    const [services, setServices] = useState<string[]>([]);
    const [facilityType, setFacilityType] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [address, setAddress] = useState<any>(null); // Google Maps Object
    const [manualAddress, setManualAddress] = useState("");
    const [auditSlots, setAuditSlots] = useState<string[]>([]);
    const [contact, setContact] = useState({ name: "", email: "", phone: "" });

    // Load Lead Data
    useEffect(() => {
        const load = async () => {
            if (!leadId) return;
            try {
                const snap = await getDoc(doc(db, "leads", leadId));
                if (snap.exists()) {
                    const data = snap.data();
                    // Pre-fill
                    if (data.serviceInterest) setServices([data.serviceInterest]);
                    if (data.wizardStep) setCurrentStep(Math.max(0, data.wizardStep - 1));
                    if (data.businessName) setCompanyName(data.businessName);
                    if (data.facilityType) setFacilityType(data.facilityType);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Audit request not found. Redirecting..."
                    });
                    setTimeout(() => window.location.href = "https://xiri.ai", 2000);
                }
            } catch (err) {
                console.error(err);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load audit request."
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [leadId, toast]);

    const updateLead = async (updates: any, nextStep?: number) => {
        setSubmitting(true);
        try {
            const data = {
                ...updates,
                updatedAt: serverTimestamp(),
                wizardStep: (nextStep !== undefined ? nextStep : currentStep) + 1
            };
            await updateDoc(doc(db, "leads", leadId), data);
            if (nextStep !== undefined) setCurrentStep(nextStep);
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Could not save your progress. Please try again."
            });
        } finally {
            setSubmitting(false);
        }
    };

    // --- STEPS ---

    // Step 1: Services
    const StepServices = () => {
        const OPTIONS = [
            { id: 'janitorial', label: 'Routine Cleaning', icon: '🧹' },
            { id: 'floor_care', label: 'Floor Care (Strip/Wax)', icon: '✨' },
            { id: 'consumables', label: 'Supplies Procurement', icon: '🧻' },
            { id: 'disinfecting', label: 'Disinfecting', icon: '🦠' },
            { id: 'snow_removal', label: 'Snow Removal', icon: '❄️' },
            { id: 'landscaping', label: 'Landscaping', icon: '🌳' },
        ];

        const toggle = (id: string) => {
            if (services.includes(id)) setServices(services.filter(s => s !== id));
            else setServices([...services, id]);
        };

        return (
            <Card className="max-w-xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>What services do you need?</CardTitle>
                    <CardDescription>Select all that apply to your facility.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    {OPTIONS.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => toggle(opt.id)}
                            className={`cursor-pointer p-4 rounded-xl border transition-all hover:bg-muted/50 ${services.includes(opt.id)
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border'}`}
                        >
                            <span className="text-2xl block mb-2">{opt.icon}</span>
                            <span className="font-semibold text-foreground">{opt.label}</span>
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={() => updateLead({ serviceInterests: services }, 1)}
                        disabled={services.length === 0 || submitting}
                        className="w-full"
                        size="lg"
                    >
                        Next Step
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Step 2: Facility
    const StepFacility = () => {
        const TYPES = [
            'Medical Office', 'Urgent Care', 'Surgery Center',
            'Auto Dealership', 'School / Daycare', 'Office Building', 'Other'
        ];

        return (
            <Card className="max-w-xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Tell us about the building.</CardTitle>
                    <CardDescription>This helps us match you with the right specialists.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Facility Type</label>
                        <Select value={facilityType} onValueChange={setFacilityType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Company Name</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="e.g. Northwell Health"
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>Back</Button>
                    <Button
                        onClick={() => updateLead({ facilityType, businessName: companyName }, 2)}
                        disabled={!facilityType || !companyName || submitting}
                        className="flex-1"
                        size="lg"
                    >
                        Next Step
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Step 3: Location
    const StepLocation = () => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

        return (
            <Card className="max-w-xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Where are you located?</CardTitle>
                    <CardDescription>We use this to assign your local Facility Manager.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {apiKey ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Search Address</label>
                            <div className="border rounded-md p-1 focus-within:ring-2 focus-within:ring-primary">
                                <GooglePlacesAutocomplete
                                    apiKey={apiKey}
                                    selectProps={{
                                        value: address,
                                        onChange: setAddress,
                                        placeholder: 'Start typing address...',
                                        styles: {
                                            control: (provided) => ({ ...provided, border: 'none', boxShadow: 'none' }),
                                            input: (provided) => ({ ...provided, border: 'none' }),
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <Input
                                    value={manualAddress}
                                    onChange={(e) => setManualAddress(e.target.value)}
                                    placeholder="123 Main St, New York, NY"
                                    className="pl-10"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Enter address manually.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
                    <Button
                        onClick={() => updateLead({ address: address ? address.label : manualAddress }, 3)}
                        disabled={(!address && !manualAddress) || submitting}
                        className="flex-1"
                        size="lg"
                    >
                        Confirm Location
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Step 4: Schedule
    const StepSchedule = () => {
        // Generate slots
        const slots = [];
        let current = startOfHour(addDays(new Date(), 1));
        for (let i = 0; i < 5; i++) {
            slots.push(addHours(current, 9));
            slots.push(addHours(current, 13));
            slots.push(addHours(current, 16));
            current = addDays(current, 1);
        }

        const toggleSlot = (dateStr: string) => {
            if (auditSlots.includes(dateStr)) setAuditSlots(auditSlots.filter(s => s !== dateStr));
            else if (auditSlots.length < 3) setAuditSlots([...auditSlots, dateStr]);
        }

        return (
            <Card className="max-w-xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>When can we visit?</CardTitle>
                    <CardDescription>Select up to 3 preferred times for your site walkthrough.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                        {slots.map((date, i) => {
                            const str = date.toISOString();
                            const displayDate = format(date, 'MMM d');
                            const displayTime = format(date, 'h:mm a');
                            const selected = auditSlots.includes(str);

                            return (
                                <button
                                    key={i}
                                    onClick={() => toggleSlot(str)}
                                    className={`p-3 rounded-lg border text-center text-sm transition-all ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:border-primary/50'}`}
                                >
                                    <div className="font-bold">{displayDate}</div>
                                    <div className={`text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{displayTime}</div>
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>Back</Button>
                    <Button
                        onClick={() => updateLead({ preferredAuditTimes: auditSlots }, 4)}
                        disabled={auditSlots.length === 0 || submitting}
                        className="flex-1"
                        size="lg"
                    >
                        Next Step
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Step 5: Contact
    const StepContact = () => {
        return (
            <Card className="max-w-xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Who should we contact?</CardTitle>
                    <CardDescription>Final step. We'll send the confirmation here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input
                                value={contact.name}
                                onChange={e => setContact({ ...contact, name: e.target.value })}
                                className="pl-10"
                                placeholder="Your Name"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email Address</label>
                        <Input
                            type="email"
                            value={contact.email}
                            onChange={e => setContact({ ...contact, email: e.target.value })}
                            placeholder="you@company.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Phone Number</label>
                        <Input
                            type="tel"
                            value={contact.phone}
                            onChange={e => setContact({ ...contact, phone: e.target.value })}
                            placeholder="(555) 123-4567"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(3)}>Back</Button>
                    <Button
                        onClick={() => updateLead({ ...contact, contactName: contact.name, contactPhone: contact.phone, status: 'new' }, 5)}
                        disabled={!contact.name || !contact.email || submitting}
                        className="flex-1"
                        size="lg"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Submit Request
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Step 6: Success
    const StepSuccess = () => (
        <Card className="max-w-lg mx-auto shadow-lg border-t-4 border-green-500 animate-in fade-in zoom-in duration-500">
            <CardContent className="pt-10 text-center space-y-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Request Received!</h2>
                    <p className="text-muted-foreground text-lg">
                        We have received your audit request for <strong>{companyName}</strong>.
                        A Facility Solutions Manager will confirm your time shortly.
                    </p>
                </div>
                <div className="pt-4 pb-2">
                    <Button variant="outline" onClick={() => window.location.href = "https://xiri.ai"}>
                        Return to Homepage
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium">Loading Audit...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Free Facility Audit</h1>
                    <p className="text-muted-foreground">step {Math.min(currentStep + 1, 5)} of 5</p>
                </div>

                {/* Progress Bar */}
                {currentStep < 5 && (
                    <div className="mb-8">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                            <span>{STEPS[currentStep]?.label}</span>
                            <span>{Math.round((currentStep / 5) * 100)}%</span>
                        </div>
                        <Progress value={(currentStep / 5) * 100} className="h-2" />
                    </div>
                )}

                {currentStep === 0 && <StepServices />}
                {currentStep === 1 && <StepFacility />}
                {currentStep === 2 && <StepLocation />}
                {currentStep === 3 && <StepSchedule />}
                {currentStep === 4 && <StepContact />}
                {currentStep === 5 && <StepSuccess />}
            </div>
        </div>
    );
}
