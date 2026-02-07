"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, CheckCircle2, Upload, Calendar, ArrowRight, ShieldCheck, Building2, Phone, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function OnboardingPage() {
    const params = useParams();
    const id = params.id as string;
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [vendorData, setVendorData] = useState<any>(null);
    const { toast } = useToast();

    // Form States
    const [companyName, setCompanyName] = useState("");
    const [phone, setPhone] = useState("");
    const [specialty, setSpecialty] = useState("");

    // Qualification States (Dynamic)
    const [answers, setAnswers] = useState<Record<string, boolean | null>>({});

    // Dynamic Requirements Logic
    const getRequirements = (specialty: string) => {
        const s = specialty.toLowerCase();
        // High Risk Trades
        if (s.includes('plumb') || s.includes('electr') || s.includes('roof') || s.includes('hvac') || s.includes('general') || s.includes('gc')) {
            return [
                { id: 'gl', label: 'General Liability Insurance' },
                { id: 'wc', label: "Worker's Compensation" },
                { id: 'auto', label: 'Commercial Auto Liability' },
                { id: 'umbrella', label: 'Umbrella / Excess Liability' }
            ];
        }
        // Medium Risk
        if (s.includes('paint') || s.includes('landscap') || s.includes('construct')) {
            return [
                { id: 'gl', label: 'General Liability Insurance' },
                { id: 'wc', label: "Worker's Compensation" },
                { id: 'auto', label: 'Commercial Auto Liability' }
            ];
        }
        // Default / Low Risk
        return [
            { id: 'gl', label: 'General Liability Insurance' }
        ];
    };

    const requirements = vendorData ? getRequirements(vendorData.specialty || "") : [];

    const handleAnswer = (reqId: string, value: boolean) => {
        setAnswers(prev => ({ ...prev, [reqId]: value }));
    };

    // Upload States (Speed Track)
    const [coiUploaded, setCoiUploaded] = useState(false);
    const [w9Uploaded, setW9Uploaded] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchVendor = async () => {
            const docRef = doc(db, "vendors", id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setVendorData(data);
                // Prefill Data
                setCompanyName(data.companyName || "");
                setPhone(data.phone || "");
                setSpecialty(data.specialty || "");

                // Resume Logic & Analytics
                let currentStep = 1;
                if (data.onboardingStep) currentStep = data.onboardingStep;

                // If status implies further progress, override
                if (data.status === 'QUALIFIED') currentStep = Math.max(currentStep, 3);

                setStep(currentStep);
            }
            setLoading(false);
        };
        fetchVendor();
    }, [id]);

    // Analytics: Track Step Views
    useEffect(() => {
        if (!id || loading) return;
        // Log the current highest step reached
        updateDoc(doc(db, "vendors", id), {
            onboardingStep: step,
            [`step${step}ViewedAt`]: serverTimestamp()
        }).catch(e => console.error("Analytics Error", e));
    }, [step, id, loading]);

    const handleStep1Submit = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, "vendors", id), {
                companyName,
                phone,
                specialty,
                status: 'NEGOTIATING',
                statusUpdatedAt: serverTimestamp()
            });
            setStep(2);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Could not save details.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleQualification = async () => {
        // Check if all displayed requirements are answered
        const allAnswered = requirements.every(r => answers[r.id] !== undefined && answers[r.id] !== null);

        if (!allAnswered || answers['entity'] === undefined || answers['entity'] === null) {
            toast({ title: "Incomplete", description: "Please answer all insurance questions and your business entity status." });
            return;
        }

        setLoading(true);

        // Qualification Logic: Simple pass for now if they answered anything
        // In real app, maybe strict check: const qualified = requirements.every(r => answers[r.id] === true);

        await updateDoc(doc(db, "vendors", id), {
            qualification: answers,
            status: 'QUALIFIED',
            statusUpdatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "vendor_activities"), {
            vendorId: id,
            type: 'QUALIFICATION',
            description: `Vendor answered qualification requirements for ${specialty}.`,
            createdAt: serverTimestamp(),
            metadata: answers
        });

        setLoading(false);
        setStep(3);
    };

    const handleSpeedTrackUpload = async (type: 'COI' | 'W9') => {
        // Mock Upload
        setTimeout(async () => {
            if (type === 'COI') setCoiUploaded(true);
            if (type === 'W9') setW9Uploaded(true);

            toast({ title: "Uploaded!", description: `${type} received.` });

            await addDoc(collection(db, "vendor_activities"), {
                vendorId: id,
                type: 'DOC_UPLOAD',
                description: `Vendor uploaded ${type} via Speed Track.`,
                createdAt: serverTimestamp(),
                metadata: { docType: type, url: "mock://url" }
            });
        }, 800);
    };

    const finishSpeedTrack = async () => {
        if (!coiUploaded || !w9Uploaded) {
            toast({ title: "Incomplete", description: "Please upload both documents for Speed Track." });
            return;
        }
        await updateDoc(doc(db, "vendors", id), {
            status: 'COMPLIANCE_REVIEW',
            speedTrack: true
        });
        setStep(4); // Success
    };

    const finishRegularTrack = async () => {
        // Book Meeting Logic
        await updateDoc(doc(db, "vendors", id), {
            status: 'ONBOARDING_SCHEDULED',
            speedTrack: false
        });
        await addDoc(collection(db, "vendor_activities"), {
            vendorId: id,
            type: 'MEETING_BOOKED',
            description: `Vendor scheduled valid onboarding call.`,
            createdAt: serverTimestamp()
        });
        setStep(4); // Success
    };

    // Replace the Qualification Step UI
    const Step2Content = () => (
        <>
            <CardHeader>
                <CardTitle>Insurance Requirements</CardTitle>
                <CardDescription>Based on your trade ({vendorData?.specialty}), please confirm your coverage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {requirements.map((req) => (
                    <div key={req.id} className="space-y-3 border-b pb-4 last:border-0">
                        <label className="text-base font-medium">Do you have {req.label}?</label>
                        <div className="flex gap-4">
                            <Button
                                variant={answers[req.id] === true ? "default" : "outline"}
                                onClick={() => handleAnswer(req.id, true)}
                                className="w-1/2"
                            >
                                Yes
                            </Button>
                            <Button
                                variant={answers[req.id] === false ? "default" : "outline"}
                                onClick={() => handleAnswer(req.id, false)}
                                className="w-1/2"
                            >
                                No
                            </Button>
                        </div>
                    </div>
                ))}

                {/* Always ask about Entity Status */}
                <div className="space-y-3 pt-2">
                    <label className="text-base font-medium">Are you a registered business entity (LLC/Corp)?</label>
                    <div className="flex gap-4">
                        <Button
                            variant={answers['entity'] === true ? "default" : "outline"}
                            onClick={() => handleAnswer('entity', true)}
                            className="w-1/2"
                        >
                            Yes
                        </Button>
                        <Button
                            variant={answers['entity'] === false ? "default" : "outline"}
                            onClick={() => handleAnswer('entity', false)}
                            className="w-1/2"
                        >
                            No
                        </Button>
                    </div>
                </div>

            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleQualification} disabled={!requirements.every(r => answers[r.id] !== undefined) || answers['entity'] === undefined}>
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </CardFooter>
        </>
    );

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!vendorData) return <div className="p-8 text-center text-red-500">Invalid Link</div>;

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {companyName}</h1>
                <p className="text-muted-foreground">{step < 4 ? "Let's get you set up." : "You're all set!"}</p>
            </div>

            {/* Progress */}
            {step < 5 && (
                <div className="flex justify-center gap-4 text-sm font-medium text-muted-foreground mb-8">
                    <span className={step >= 1 ? "text-primary font-bold" : ""}>1. Details</span>
                    <span>→</span>
                    <span className={step >= 2 ? "text-primary font-bold" : ""}>2. Qualify</span>
                    <span>→</span>
                    <span className={step >= 3 ? "text-primary font-bold" : ""}>3. Next Steps</span>
                </div>
            )}

            <Card className="border-t-4 border-t-primary shadow-lg max-w-lg mx-auto">
                {step === 1 && (
                    <>
                        <CardHeader>
                            <CardTitle>Confirm Details</CardTitle>
                            <CardDescription>We pre-filled this from our records. Is it correct?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Name</label>
                                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</label>
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2"><User className="w-4 h-4" /> Specialty</label>
                                <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleStep1Submit}>Looks Good <ArrowRight className="ml-2 w-4 h-4" /></Button>
                        </CardFooter>
                    </>
                )}

                {step === 2 && <Step2Content />}

                {step === 3 && (
                    <>
                        <CardHeader>
                            <CardTitle>Choose Your Path</CardTitle>
                            <CardDescription>How would you like to proceed?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Option A: Talk */}
                            <div className="border rounded-lg p-4 space-y-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Book an Intro Call</h3>
                                    <Badge variant="secondary">Popular</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">Schedule a 15-min chat with our Vendor Manager to ask questions.</p>
                                <Button variant="outline" className="w-full" onClick={finishRegularTrack}>Schedule Now</Button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                            </div>

                            {/* Option B: Speed Track */}
                            <div className="border rounded-lg p-4 space-y-4 hover:bg-slate-50 transition-colors border-green-200 bg-green-50/30">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-green-600" /> Speed Track</h3>
                                    <Badge className="bg-green-600 hover:bg-green-700">Fastest</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">Skip the call. Upload your docs now to get approved immediately.</p>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="sm" variant={coiUploaded ? "default" : "secondary"} onClick={() => handleSpeedTrackUpload('COI')}>
                                        {coiUploaded ? "COI ✓" : "Upload COI"}
                                    </Button>
                                    <Button size="sm" variant={w9Uploaded ? "default" : "secondary"} onClick={() => handleSpeedTrackUpload('W9')}>
                                        {w9Uploaded ? "W9 ✓" : "Upload W9"}
                                    </Button>
                                </div>
                                <Button className="w-full mt-2" onClick={finishSpeedTrack} disabled={!coiUploaded || !w9Uploaded}>
                                    Submit Documents
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {step === 4 && (
                    <div className="text-center py-12 px-6 space-y-4">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in spin-in-3 duration-500">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold">You're in the Pipeline!</h2>
                        <p className="text-muted-foreground">
                            {w9Uploaded
                                ? "Thanks for fast-tracking. We'll review your docs within 24 hours."
                                : "We look forward to speaking with you at your scheduled time."}
                        </p>
                        <p className="text-sm text-muted-foreground mt-4">Close this window anytime.</p>
                    </div>
                )}
            </Card>
        </div>
    );
}

// Helper component for Badges since I didn't import it at top (wait, I did check imports)
import { Badge } from "@/components/ui/badge";
