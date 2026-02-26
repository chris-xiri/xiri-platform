'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, CheckIn, CheckInTask } from '@xiri/shared';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, QrCode, CheckCircle2, Star, Camera,
    Trophy, Zap, Send, AlertTriangle, Phone, MessageSquare
} from 'lucide-react';

function CheckInFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useAuth();

    const woId = searchParams.get('woId');

    const [wo, setWo] = useState<(WorkOrder & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<'qr' | 'tasks' | 'score' | 'done'>('qr');

    // Vendor contact
    const [vendorContact, setVendorContact] = useState<{ name: string; phone: string; company: string } | null>(null);

    // QR state
    const [qrInput, setQrInput] = useState('');
    const [qrValid, setQrValid] = useState<boolean | null>(null);
    const [scannerActive, setScannerActive] = useState(false);
    const scannerRef = useRef<any>(null);

    // Task state
    const [tasks, setTasks] = useState<CheckInTask[]>([]);

    // Score state
    const [auditScore, setAuditScore] = useState(0);
    const [auditNotes, setAuditNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!woId) return;
        async function fetchWO() {
            try {
                const snap = await getDoc(doc(db, 'work_orders', woId!));
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as WorkOrder & { id: string };
                    setWo(data);
                    // Initialize tasks from work order
                    setTasks(
                        (data.tasks || []).map(t => ({
                            taskId: t.id,
                            taskName: t.name,
                            completed: false,
                            notes: '',
                        }))
                    );
                    // Fetch vendor contact
                    if (data.vendorId) {
                        const vendorSnap = await getDoc(doc(db, 'vendors', data.vendorId));
                        if (vendorSnap.exists()) {
                            const v = vendorSnap.data();
                            setVendorContact({
                                name: v.contactName || 'Unknown',
                                phone: v.phone || v.contactPhone || '',
                                company: v.companyName || '',
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchWO();
    }, [woId]);

    // Start QR scanner
    useEffect(() => {
        if (step !== 'qr' || !scannerActive) return;

        let scanner: any = null;
        async function startScanner() {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                scanner = new Html5Qrcode('qr-reader');
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decoded: string) => {
                        handleQrResult(decoded);
                        scanner.stop().catch(() => { });
                    },
                    () => { }
                );
            } catch (err) {
                console.error('Camera error:', err);
                setScannerActive(false);
            }
        }

        startScanner();
        return () => {
            if (scanner) scanner.stop().catch(() => { });
        };
    }, [step, scannerActive]);

    const handleQrResult = (scannedCode: string) => {
        const isValid = scannedCode === wo?.qrCodeSecret;
        setQrValid(isValid);
        setQrInput(scannedCode);
        setScannerActive(false);

        if (isValid) {
            setTimeout(() => setStep('tasks'), 800);
        }
    };

    const handleManualQr = () => {
        if (!qrInput || !wo) return;
        handleQrResult(qrInput);
    };

    const toggleTask = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.taskId === taskId ? { ...t, completed: !t.completed } : t
        ));
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 100;

    const handleSubmit = async () => {
        if (!wo || !profile || auditScore === 0) return;
        setSubmitting(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const checkIn: Omit<CheckIn, 'id'> = {
                workOrderId: wo.id,
                locationName: wo.locationName,
                serviceType: wo.serviceType,
                qrScannedAt: serverTimestamp(),
                qrValid: qrValid === true,
                tasksCompleted: tasks,
                completionRate,
                auditScore,
                auditNotes: auditNotes || undefined,
                nightManagerId: userId,
                nightManagerName: profile.displayName || userId,
                vendorId: wo.vendorId,
                vendorName: wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName,
                checkInDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'check_ins'), checkIn);

            await addDoc(collection(db, 'activity_logs'), {
                type: 'AUDIT_CHECK_IN',
                workOrderId: wo.id,
                locationName: wo.locationName,
                completionRate,
                auditScore,
                nightManagerId: userId,
                createdAt: serverTimestamp(),
            });

            setStep('done');
        } catch (err) {
            console.error('Error submitting check-in:', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!wo) return <div className="p-8 text-center">Work order not found</div>;

    return (
        <div className="max-w-lg mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/operations/audits')}
                    className="shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold truncate">{wo.locationName}</h1>
                    <p className="text-xs text-muted-foreground">{wo.serviceType}</p>
                </div>
                {/* Step indicator */}
                <div className="flex gap-1">
                    {['qr', 'tasks', 'score'].map((s, i) => (
                        <div
                            key={s}
                            className={`w-8 h-1.5 rounded-full transition-colors ${s === step ? 'bg-primary' :
                                ['qr', 'tasks', 'score'].indexOf(step) > i ? 'bg-green-500' : 'bg-muted'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Vendor Contact Bar */}
            {vendorContact && step !== 'done' && (
                <div className="flex items-center justify-between p-3 mb-4 rounded-xl bg-muted/40 border">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{vendorContact.company}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{vendorContact.name}</p>
                        </div>
                    </div>
                    {vendorContact.phone && (
                        <div className="flex gap-2 shrink-0">
                            <a href={`tel:${vendorContact.phone}`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                                    <Phone className="w-3.5 h-3.5" /> Call
                                </Button>
                            </a>
                            <a href={`sms:${vendorContact.phone}`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                                    <MessageSquare className="w-3.5 h-3.5" /> Text
                                </Button>
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Step 1: QR Verification */}
            {step === 'qr' && (
                <div className="space-y-4">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                            <QrCode className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold">Scan QR Code</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Scan the QR code posted at the facility to verify you&apos;re on-site.
                        </p>
                    </div>

                    {qrValid === true && (
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 animate-in fade-in">
                            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                            <div>
                                <p className="font-medium text-green-800 dark:text-green-300">Verified! ✅</p>
                                <p className="text-xs text-green-600 dark:text-green-400">On-site confirmed. Moving to task checklist...</p>
                            </div>
                        </div>
                    )}

                    {qrValid === false && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-300">Invalid QR Code</p>
                                <p className="text-xs text-red-600 dark:text-red-400">This doesn&apos;t match this location. Try again.</p>
                            </div>
                        </div>
                    )}

                    {!scannerActive && qrValid !== true && (
                        <div className="space-y-3">
                            <Button
                                onClick={() => setScannerActive(true)}
                                className="w-full h-14 text-base gap-3"
                                size="lg"
                            >
                                <Camera className="w-5 h-5" />
                                Open Camera to Scan
                            </Button>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">or enter code manually</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter QR code..."
                                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={qrInput}
                                    onChange={(e) => setQrInput(e.target.value)}
                                />
                                <Button onClick={handleManualQr} disabled={!qrInput}>
                                    Verify
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                className="w-full text-xs text-muted-foreground"
                                onClick={() => {
                                    setQrValid(true);
                                    setTimeout(() => setStep('tasks'), 500);
                                }}
                            >
                                Skip verification (testing only)
                            </Button>
                        </div>
                    )}

                    {scannerActive && (
                        <div className="space-y-3">
                            <div id="qr-reader" className="rounded-xl overflow-hidden" />
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setScannerActive(false);
                                    scannerRef.current?.stop().catch(() => { });
                                }}
                            >
                                Cancel Scan
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Task Checklist */}
            {step === 'tasks' && (
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold">Task Checklist</h2>
                        <p className="text-sm text-muted-foreground">
                            Verify each task was completed by the contractor.
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="bg-muted/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{completedCount}/{tasks.length} verified</span>
                            <span className={`text-sm font-bold ${completionRate === 100 ? 'text-green-600' : 'text-primary'}`}>
                                {completionRate}%
                            </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${completionRate === 100
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                                    : 'bg-gradient-to-r from-primary to-blue-400'
                                    }`}
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Task list */}
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <Card
                                key={task.taskId}
                                className={`cursor-pointer transition-all active:scale-[0.98] ${task.completed ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : ''
                                    }`}
                                onClick={() => toggleTask(task.taskId)}
                            >
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${task.completed
                                        ? 'bg-green-500 border-green-500'
                                        : 'border-muted-foreground/30'
                                        }`}>
                                        {task.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className={`text-sm font-medium ${task.completed ? 'text-green-800 dark:text-green-300 line-through' : ''}`}>
                                        {task.taskName}
                                    </span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {completionRate === 100 && (
                        <div className="text-center py-2 animate-in fade-in">
                            <p className="text-sm font-medium text-green-600">All tasks verified! 🎉</p>
                        </div>
                    )}

                    {tasks.length === 0 && (
                        <Card>
                            <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                No task template assigned to this work order.
                            </CardContent>
                        </Card>
                    )}

                    <Button
                        className="w-full h-12 text-base"
                        onClick={() => setStep('score')}
                    >
                        Continue to Rating
                    </Button>
                </div>
            )}

            {/* Step 3: Audit Score */}
            {step === 'score' && (
                <div className="space-y-6">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold">Rate This Audit</h2>
                        <p className="text-sm text-muted-foreground">
                            How was the quality of work tonight?
                        </p>
                    </div>

                    {/* Star Rating - BIG touch targets */}
                    <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map(score => (
                            <button
                                key={score}
                                type="button"
                                onClick={() => setAuditScore(score)}
                                className="transition-transform active:scale-90 hover:scale-110"
                            >
                                <Star
                                    className={`w-12 h-12 transition-colors ${score <= auditScore
                                        ? 'text-amber-400 fill-amber-400 drop-shadow-lg'
                                        : 'text-muted-foreground/20'
                                        }`}
                                />
                            </button>
                        ))}
                    </div>
                    {auditScore > 0 && (
                        <p className="text-center text-sm font-medium text-muted-foreground">
                            {auditScore === 5 ? '⭐ Excellent work!' :
                                auditScore === 4 ? '👍 Good quality' :
                                    auditScore === 3 ? '😐 Average — needs attention' :
                                        auditScore === 2 ? '⚠️ Below standard' :
                                            '🚨 Major issues found'}
                        </p>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                        <textarea
                            className="w-full min-h-[100px] rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none"
                            placeholder="Any issues or observations tonight..."
                            value={auditNotes}
                            onChange={(e) => setAuditNotes(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <Card className="bg-muted/30">
                        <CardContent className="p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Location</span>
                                <span className="font-medium">{wo.locationName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tasks Verified</span>
                                <span className="font-medium">{completedCount}/{tasks.length} ({completionRate}%)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">QR Verified</span>
                                <span className="font-medium">{qrValid ? '✅ Yes' : '⚠️ Skipped'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Rating</span>
                                <span className="font-medium">{'⭐'.repeat(auditScore)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        className="w-full h-14 text-base gap-3 bg-green-600 hover:bg-green-700"
                        onClick={handleSubmit}
                        disabled={submitting || auditScore === 0}
                        size="lg"
                    >
                        <Send className="w-5 h-5" />
                        {submitting ? 'Submitting...' : 'Submit Audit'}
                    </Button>
                </div>
            )}

            {/* Step 4: Done (Celebration) */}
            {step === 'done' && (
                <div className="text-center py-12 space-y-6 animate-in fade-in">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <Trophy className="w-12 h-12 text-white" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold">Audit Complete! 🎉</h2>
                        <p className="text-muted-foreground mt-2">
                            {wo.locationName} has been audited.
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium">+1 to your streak!</span>
                    </div>

                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                        <Button
                            className="w-full h-12"
                            onClick={() => router.push('/operations/audits')}
                        >
                            Next Audit →
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => router.push('/operations/audits')}
                        >
                            Back to Dashboard
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CheckInPage() {
    return (
        <Suspense fallback={<div className="p-8 flex justify-center">Loading...</div>}>
            <CheckInFlow />
        </Suspense>
    );
}
