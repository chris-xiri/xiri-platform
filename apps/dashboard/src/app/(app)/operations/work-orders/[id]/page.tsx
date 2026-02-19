'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, VendorAssignment } from '@xiri/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, MapPin, Clock, DollarSign, User2, CheckCircle2,
    AlertCircle, Search, Calendar, Shield, QrCode, Truck
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; color: string }> = {
    pending_assignment: { variant: 'destructive', label: 'Needs Vendor', color: 'text-red-600' },
    active: { variant: 'default', label: 'Active', color: 'text-green-600' },
    paused: { variant: 'secondary', label: 'Paused', color: 'text-yellow-600' },
    completed: { variant: 'outline', label: 'Completed', color: 'text-gray-500' },
    cancelled: { variant: 'secondary', label: 'Cancelled', color: 'text-gray-400' },
};

interface VendorCandidate {
    id: string;
    companyName: string;
    contactName: string;
    services: string[];
    status: string;
    zipCode: string;
}

export default function WorkOrderDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const [wo, setWo] = useState<(WorkOrder & { id: string }) | null>(null);
    const [loading, setLoading] = useState(true);

    // Vendor assignment state
    const [showAssign, setShowAssign] = useState(false);
    const [vendorSearch, setVendorSearch] = useState('');
    const [vendors, setVendors] = useState<VendorCandidate[]>([]);
    const [selectedVendor, setSelectedVendor] = useState<VendorCandidate | null>(null);
    const [vendorRate, setVendorRate] = useState<number>(0);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        async function fetchWO() {
            try {
                const docSnap = await getDoc(doc(db, 'work_orders', params.id));
                if (docSnap.exists()) {
                    setWo({ id: docSnap.id, ...docSnap.data() } as WorkOrder & { id: string });
                }
            } catch (err) {
                console.error('Error fetching work order:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchWO();
    }, [params.id]);

    // Fetch qualified vendors when assignment panel opens
    useEffect(() => {
        if (!showAssign) return;
        async function fetchVendors() {
            const q = query(collection(db, 'vendors'), where('status', '==', 'qualified'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorCandidate));
            setVendors(data);
        }
        fetchVendors();
    }, [showAssign]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const handleAssignVendor = async () => {
        if (!wo || !selectedVendor || !profile || vendorRate <= 0) return;
        setAssigning(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const newAssignment: any = {
                vendorId: selectedVendor.id,
                vendorName: selectedVendor.companyName,
                vendorRate,
                assignedAt: new Date().toISOString(),
            };

            const updatedHistory = [...(wo.vendorHistory || []), newAssignment];
            const margin = wo.clientRate - vendorRate;

            await updateDoc(doc(db, 'work_orders', wo.id), {
                vendorId: selectedVendor.id,
                vendorRate,
                vendorHistory: updatedHistory,
                margin,
                status: 'active',
                assignedBy: userId,
                updatedAt: serverTimestamp(),
            });

            // Log activity
            await addDoc(collection(db, 'activity_logs'), {
                type: 'VENDOR_ASSIGNED',
                workOrderId: wo.id,
                vendorId: selectedVendor.id,
                vendorName: selectedVendor.companyName,
                vendorRate,
                clientRate: wo.clientRate,
                margin,
                assignedBy: userId,
                createdAt: serverTimestamp(),
            });

            // Refresh
            setWo({
                ...wo,
                vendorId: selectedVendor.id,
                vendorRate,
                vendorHistory: updatedHistory,
                margin,
                status: 'active',
            });
            setShowAssign(false);
            setSelectedVendor(null);
            setVendorRate(0);
        } catch (err) {
            console.error('Error assigning vendor:', err);
        } finally {
            setAssigning(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!wo || !profile) return;
        try {
            await updateDoc(doc(db, 'work_orders', wo.id), {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'activity_logs'), {
                type: 'WORK_ORDER_STATUS_CHANGE',
                workOrderId: wo.id,
                fromStatus: wo.status,
                toStatus: newStatus,
                changedBy: profile.uid || profile.email || 'unknown',
                createdAt: serverTimestamp(),
            });
            setWo({ ...wo, status: newStatus as any });
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!wo) return <div className="p-8 flex justify-center">Work order not found</div>;

    const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending_assignment;
    const margin = wo.vendorRate ? wo.clientRate - wo.vendorRate : null;
    const filteredVendors = vendors.filter(v =>
        v.companyName?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.contactName?.toLowerCase().includes(vendorSearch.toLowerCase())
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/operations/work-orders" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {wo.serviceType}
                            <Badge variant={config.variant}>{config.label}</Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> {wo.locationName} • ID: {wo.id?.slice(0, 8)}
                        </p>
                    </div>
                </div>

                {/* Status Actions */}
                <div className="flex gap-2">
                    {wo.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange('paused')}>Pause</Button>
                    )}
                    {wo.status === 'paused' && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange('active')}>Resume</Button>
                    )}
                    {(wo.status === 'active' || wo.status === 'paused') && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange('completed')}>Complete</Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Overview */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">Client Rate</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(wo.clientRate)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">Vendor Rate</p>
                                <p className="text-2xl font-bold">
                                    {wo.vendorRate ? formatCurrency(wo.vendorRate) : <span className="text-muted-foreground">—</span>}
                                    {wo.vendorRate && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">Margin</p>
                                <p className={`text-2xl font-bold ${margin !== null ? (margin > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                                    {margin !== null ? formatCurrency(margin) : <span className="text-muted-foreground">—</span>}
                                    {margin !== null && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Schedule */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" /> Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Frequency</p>
                                <p className="font-medium capitalize">{wo.schedule?.frequency}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Start Time</p>
                                <p className="font-medium">{wo.schedule?.startTime || '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Days</p>
                                <div className="flex gap-1 mt-0.5">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                        <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${wo.schedule?.daysOfWeek?.[i] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Task Checklist */}
                    {wo.tasks && wo.tasks.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-muted-foreground" /> Task Checklist
                                </CardTitle>
                                <CardDescription>{wo.tasks.length} tasks</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {wo.tasks.map((task, i) => (
                                    <div key={task.id || i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${task.verifiedAt ? 'bg-green-100 border-green-500' : 'border-muted-foreground/30'}`}>
                                            {task.verifiedAt && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">
                                                {task.name}
                                                {task.required && <span className="text-red-500 ml-1">*</span>}
                                            </p>
                                            {task.description && (
                                                <p className="text-xs text-muted-foreground">{task.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Vendor History */}
                    {wo.vendorHistory && wo.vendorHistory.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Vendor History</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {wo.vendorHistory.map((v, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                                        <div className="flex items-center gap-3">
                                            <Truck className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">{v.vendorName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(v.vendorRate)}/mo •
                                                    Assigned {new Date(v.assignedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        {v.removedAt && (
                                            <Badge variant="secondary" className="text-xs">
                                                Removed: {v.removalReason || 'N/A'}
                                            </Badge>
                                        )}
                                        {!v.removedAt && i === wo.vendorHistory.length - 1 && (
                                            <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">Current</Badge>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Assignment Panel */}
                <div className="space-y-6">
                    {/* Current Vendor */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <User2 className="w-4 h-4 text-muted-foreground" /> Assigned Vendor
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {wo.vendorId ? (
                                <div>
                                    <p className="font-medium">{wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Assigned'}</p>
                                    <p className="text-sm text-muted-foreground">{formatCurrency(wo.vendorRate!)}/mo</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 w-full"
                                        onClick={() => setShowAssign(true)}
                                    >
                                        Replace Vendor
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
                                    <p className="text-sm font-medium text-red-600">No vendor assigned</p>
                                    <Button
                                        className="mt-3 w-full gap-2"
                                        onClick={() => setShowAssign(true)}
                                    >
                                        <Search className="w-4 h-4" /> Assign Vendor
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* QR Code */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-muted-foreground" /> Verification
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground mb-2">QR Secret for Night Manager check-in:</p>
                            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{wo.qrCodeSecret}</code>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Vendor Assignment Modal */}
            {showAssign && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b">
                            <div>
                                <h2 className="text-lg font-bold">Assign Vendor</h2>
                                <p className="text-sm text-muted-foreground">
                                    {wo.serviceType} at {wo.locationName} • Client rate: {formatCurrency(wo.clientRate)}/mo
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setShowAssign(false); setSelectedVendor(null); }}>✕</Button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Search */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search qualified vendors..."
                                    className="pl-9"
                                    value={vendorSearch}
                                    onChange={(e) => setVendorSearch(e.target.value)}
                                />
                            </div>

                            {/* Vendor List */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {filteredVendors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No qualified vendors found. Add vendors in the Supply CRM first.
                                    </p>
                                ) : (
                                    filteredVendors.map((v) => (
                                        <Card
                                            key={v.id}
                                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedVendor?.id === v.id ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                            onClick={() => setSelectedVendor(v)}
                                        >
                                            <CardContent className="p-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{v.companyName}</p>
                                                    <p className="text-xs text-muted-foreground">{v.contactName} • {v.zipCode}</p>
                                                </div>
                                                {selectedVendor?.id === v.id && (
                                                    <CheckCircle2 className="w-5 h-5 text-primary" />
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            {/* Vendor Rate */}
                            {selectedVendor && (
                                <div className="border-t pt-4 space-y-3">
                                    <div>
                                        <Label className="text-sm">Vendor Monthly Rate</Label>
                                        <div className="relative mt-1">
                                            <DollarSign className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                placeholder="1800"
                                                className="pl-8"
                                                value={vendorRate || ''}
                                                onChange={(e) => setVendorRate(parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>

                                    {vendorRate > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                                            <span className="text-sm text-muted-foreground">Projected Monthly Margin:</span>
                                            <span className={`text-lg font-bold ${wo.clientRate - vendorRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(wo.clientRate - vendorRate)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => { setShowAssign(false); setSelectedVendor(null); }}>Cancel</Button>
                            <Button
                                onClick={handleAssignVendor}
                                disabled={!selectedVendor || vendorRate <= 0 || assigning}
                                className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                                {assigning ? 'Assigning...' : 'Assign Vendor'}
                                <CheckCircle2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
