'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, VendorAssignment } from '@xiri-facility-solutions/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, MapPin, Clock, DollarSign, User2, CheckCircle2,
    AlertCircle, Search, Calendar, Shield, Truck, Star, Printer, Moon, Pencil, Package,
    FileText, Upload, ExternalLink, Loader2, Trash2, Paperclip, FileCheck
} from 'lucide-react';
import Link from 'next/link';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PageProps {
    params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; color: string }> = {
    pending_assignment: { variant: 'destructive', label: 'Needs Vendor', color: 'text-red-600' },
    scheduled: { variant: 'default', label: 'Scheduled', color: 'text-blue-600' },
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
    city?: string;
    state?: string;
    coverageAreas?: string[];
    capabilityMatch: boolean;
    locationMatch: boolean;
}

export default function WorkOrderDetailPage({ params }: PageProps) {
    const { id } = use(params);
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

    // Night Manager assignment state
    const [nmUsers, setNmUsers] = useState<{ uid: string; displayName: string }[]>([]);
    const [showNmDropdown, setShowNmDropdown] = useState(false);
    const [assigningNm, setAssigningNm] = useState(false);
    const nmDropdownRef = useRef<HTMLDivElement>(null);
    const [quoteId, setQuoteId] = useState<string | null>(null);

    // Signed SOW Document State
    const [sowDoc, setSowDoc] = useState<{ url: string; name: string } | null>(null);
    const [uploadingSow, setUploadingSow] = useState(false);
    const [sowProgress, setSowProgress] = useState(0);
    const sowFileInputRef = useRef<HTMLInputElement>(null);

    // Scheduled Date & Time State for One-Time Work Orders
    const [scheduledDateVal, setScheduledDateVal] = useState<string>('');
    const [scheduledTimeVal, setScheduledTimeVal] = useState<string>('');
    const [savingSchedule, setSavingSchedule] = useState(false);

    useEffect(() => {
        async function fetchWO() {
            try {
                const docSnap = await getDoc(doc(db, 'work_orders', id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setWo({ id: docSnap.id, ...data } as WorkOrder & { id: string });

                    if (data.scheduledDate) {
                        setScheduledDateVal(data.scheduledDate);
                    } else if (data.serviceStartDate) {
                        const sDate = typeof data.serviceStartDate === 'string' ? data.serviceStartDate.split('T')[0] : '';
                        if (sDate) setScheduledDateVal(sDate);
                    }
                    if (data.scheduledStartTime || data.schedule?.startTime) {
                        setScheduledTimeVal(data.scheduledStartTime || data.schedule?.startTime || '');
                    }

                    if (data.sowDocumentUrl) {
                        setSowDoc({ url: data.sowDocumentUrl, name: data.sowDocumentName || 'Signed_SOW.pdf' });
                    } else {
                        // Fallback: check quote or contract
                        const qId = data.quoteId;
                        const cId = data.contractId;
                        if (qId) {
                            getDoc(doc(db, 'quotes', qId)).then(qSnap => {
                                if (qSnap.exists() && qSnap.data().signedSowUrl) {
                                    setSowDoc({ url: qSnap.data().signedSowUrl, name: qSnap.data().signedSowName || 'Signed_SOW.pdf' });
                                }
                            });
                        } else if (cId) {
                            getDoc(doc(db, 'contracts', cId)).then(cSnap => {
                                if (cSnap.exists() && cSnap.data().signedSowUrl) {
                                    setSowDoc({ url: cSnap.data().signedSowUrl, name: cSnap.data().signedSowName || 'Signed_SOW.pdf' });
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching work order:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchWO();
    }, [id]);

    const handleSaveScheduleDate = async () => {
        if (!wo || !scheduledDateVal) return;
        setSavingSchedule(true);
        try {
            const nextStatus = wo.status === 'pending_assignment' && wo.vendorId ? 'scheduled' : wo.status;
            await updateDoc(doc(db, 'work_orders', wo.id), {
                scheduledDate: scheduledDateVal,
                scheduledStartTime: scheduledTimeVal || null,
                status: nextStatus,
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'WORK_ORDER_SCHEDULED',
                workOrderId: wo.id,
                scheduledDate: scheduledDateVal,
                scheduledTime: scheduledTimeVal,
                updatedBy: profile?.uid || 'unknown',
                createdAt: serverTimestamp(),
            });

            setWo(prev => prev ? ({
                ...prev,
                scheduledDate: scheduledDateVal,
                scheduledStartTime: scheduledTimeVal,
                status: nextStatus,
            } as any) : null);
        } catch (err) {
            console.error('Error saving schedule date:', err);
            alert('Failed to save schedule date.');
        } finally {
            setSavingSchedule(false);
        }
    };

    // Fetch quoteId from the contract
    useEffect(() => {
        if (!wo?.contractId) return;
        async function fetchQuoteId() {
            try {
                const contractSnap = await getDoc(doc(db, 'contracts', wo!.contractId));
                if (contractSnap.exists()) {
                    const cData = contractSnap.data() as any;
                    setQuoteId(cData.quoteId || null);
                    if (!sowDoc && cData.signedSowUrl) {
                        setSowDoc({ url: cData.signedSowUrl, name: cData.signedSowName || 'Signed_SOW.pdf' });
                    }
                }
            } catch (err) {
                console.error('Error fetching contract for quoteId:', err);
            }
        }
        fetchQuoteId();
    }, [wo?.contractId, sowDoc]);

    const handleUploadSowFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !wo) return;
        setUploadingSow(true);
        try {
            const storagePath = `signed_sow_documents/wo_${wo.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setSowProgress(Math.round(progress));
                },
                (err) => {
                    console.error('SOW Upload failed:', err);
                    alert('Failed to upload signed SOW document.');
                    setUploadingSow(false);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateDoc(doc(db, 'work_orders', wo.id), {
                        sowDocumentUrl: downloadUrl,
                        sowDocumentName: file.name,
                        sowUploadedAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    // If linked to a quote, also update quote
                    if (wo.quoteId) {
                        try {
                            await updateDoc(doc(db, 'quotes', wo.quoteId), {
                                signedSowUrl: downloadUrl,
                                signedSowName: file.name,
                                signedSowUploadedAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                            });
                        } catch (qe) { /* ignore */ }
                    }

                    setWo(prev => prev ? ({
                        ...prev,
                        sowDocumentUrl: downloadUrl,
                        sowDocumentName: file.name,
                    } as any) : null);
                    setSowDoc({ url: downloadUrl, name: file.name });
                    setUploadingSow(false);
                    setSowProgress(0);
                }
            );
        } catch (err) {
            console.error('Error uploading SOW on work order:', err);
            setUploadingSow(false);
        }
    };

    const handleRemoveSowFile = async () => {
        if (!wo || !confirm('Remove attached SOW document from this work order?')) return;
        try {
            await updateDoc(doc(db, 'work_orders', wo.id), {
                sowDocumentUrl: null,
                sowDocumentName: null,
                sowUploadedAt: null,
                updatedAt: serverTimestamp(),
            });
            setWo(prev => prev ? ({
                ...prev,
                sowDocumentUrl: undefined,
                sowDocumentName: undefined,
            } as any) : null);
            setSowDoc(null);
        } catch (err) {
            console.error('Error removing SOW from work order:', err);
        }
    };

    // Contractor SOW Document State & Handlers
    const [uploadingContractorSow, setUploadingContractorSow] = useState(false);
    const [contractorSowProgress, setContractorSowProgress] = useState(0);
    const contractorSowFileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadContractorSow = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !wo) return;
        setUploadingContractorSow(true);
        try {
            const storagePath = `contractor_sow_documents/wo_${wo.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setContractorSowProgress(Math.round(progress));
                },
                (err) => {
                    console.error('Contractor SOW upload failed:', err);
                    alert('Failed to upload contractor SOW.');
                    setUploadingContractorSow(false);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateDoc(doc(db, 'work_orders', wo.id), {
                        contractorSowUrl: downloadUrl,
                        contractorSowName: file.name,
                        contractorSowUploadedAt: serverTimestamp(),
                        contractorRateConfirmed: true,
                        updatedAt: serverTimestamp(),
                    });

                    await addDoc(collection(db, 'activity_logs'), {
                        type: 'CONTRACTOR_SOW_UPLOADED',
                        workOrderId: wo.id,
                        vendorId: wo.vendorId || null,
                        fileName: file.name,
                        uploadedBy: profile?.uid || 'unknown',
                        createdAt: serverTimestamp(),
                    });

                    setWo(prev => prev ? ({
                        ...prev,
                        contractorSowUrl: downloadUrl,
                        contractorSowName: file.name,
                        contractorRateConfirmed: true,
                    } as any) : null);
                    setUploadingContractorSow(false);
                    setContractorSowProgress(0);
                }
            );
        } catch (err) {
            console.error('Error uploading contractor SOW:', err);
            setUploadingContractorSow(false);
        }
    };

    const handleRemoveContractorSow = async () => {
        if (!wo || !confirm('Remove contractor SOW agreement from this work order?')) return;
        try {
            await updateDoc(doc(db, 'work_orders', wo.id), {
                contractorSowUrl: null,
                contractorSowName: null,
                contractorSowUploadedAt: null,
                contractorRateConfirmed: false,
                updatedAt: serverTimestamp(),
            });
            setWo(prev => prev ? ({
                ...prev,
                contractorSowUrl: undefined,
                contractorSowName: undefined,
                contractorRateConfirmed: false,
            } as any) : null);
        } catch (err) {
            console.error('Error removing contractor SOW:', err);
        }
    };

    // Fetch assignment-ready vendors when assignment panel opens
    useEffect(() => {
        if (!showAssign || !wo) return;
        async function fetchVendors() {
            const q = query(collection(db, 'vendors'), where('status', 'in', ['approved', 'ready_for_assignment', 'active', 'onboarding']));
            const snap = await getDocs(q);
            const woServiceLower = wo!.serviceType?.toLowerCase() || '';
            const woZip = wo!.locationZip || '';

            const data = snap.docs.map(d => {
                const raw = d.data();
                const services: string[] = raw.capabilities || raw.services || [];
                const zipCode = raw.zip || raw.zipCode || '';
                const coverageAreas: string[] = raw.coverageAreas || raw.serviceAreas || [];

                // Capability match: check if any vendor service matches the work order service type
                const capabilityMatch = services.some(s =>
                    s.toLowerCase().includes(woServiceLower) ||
                    woServiceLower.includes(s.toLowerCase())
                );

                // Location match: exact zip match or zip in coverage areas
                const locationMatch = (
                    (woZip && zipCode === woZip) ||
                    coverageAreas.some(a => a.includes(woZip))
                );

                return {
                    id: d.id,
                    companyName: raw.businessName || raw.companyName || 'Unknown',
                    contactName: raw.contactName || '',
                    services,
                    status: raw.status || '',
                    zipCode,
                    city: raw.city || '',
                    state: raw.state || '',
                    coverageAreas,
                    capabilityMatch,
                    locationMatch,
                } as VendorCandidate;
            });

            // Sort: both matches > capability only > location only > neither
            data.sort((a, b) => {
                const scoreA = (a.capabilityMatch ? 2 : 0) + (a.locationMatch ? 1 : 0);
                const scoreB = (b.capabilityMatch ? 2 : 0) + (b.locationMatch ? 1 : 0);
                return scoreB - scoreA;
            });

            setVendors(data);
        }
        fetchVendors();
    }, [showAssign, wo]);

    // Fetch Night Manager users
    useEffect(() => {
        async function fetchNmUsers() {
            const snap = await getDocs(query(collection(db, 'users'), where('roles', 'array-contains-any', ['night_manager', 'night_mgr'])));
            setNmUsers(snap.docs.map(d => ({ uid: d.id, displayName: (d.data() as any).displayName || d.id })));
        }
        fetchNmUsers();
    }, []);

    // Click outside to close NM dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (nmDropdownRef.current && !nmDropdownRef.current.contains(e.target as Node)) {
                setShowNmDropdown(false);
            }
        };
        if (showNmDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showNmDropdown]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const formatFrequency = (freq?: string, daysOfWeek?: boolean[]) => {
        if (!freq) return '—';
        if (freq === 'custom_days' && daysOfWeek) {
            const days = daysOfWeek.map((on, i) => on ? DAY_NAMES[i] : null).filter(Boolean);
            const monFri = [false, true, true, true, true, true, false];
            if (JSON.stringify(daysOfWeek) === JSON.stringify(monFri)) return 'Mon–Fri';
            return days.join(', ') || 'Custom';
        }
        const labels: Record<string, string> = {
            one_time: 'One-Time', nightly: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly',
            monthly: 'Monthly', quarterly: 'Quarterly', custom_days: 'Custom',
        };
        return labels[freq] || freq;
    };

    const handleAssignVendor = async () => {
        if (!wo || !selectedVendor || !profile || vendorRate <= 0) return;
        setAssigning(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const frequency = wo.schedule?.frequency || 'monthly';
            const rateType = frequency === 'one_time' ? 'one_time' : 'recurring';
            const newAssignment: any = {
                vendorId: selectedVendor.id,
                vendorName: selectedVendor.companyName,
                vendorRate,
                vendorPaymentFrequency: frequency,
                vendorRateType: rateType,
                assignedAt: new Date().toISOString(),
            };

            const updatedHistory = [...(wo.vendorHistory || []), newAssignment];
            const margin = wo.clientRate - vendorRate;

            await updateDoc(doc(db, 'work_orders', wo.id), {
                vendorId: selectedVendor.id,
                vendorRate,
                vendorPaymentFrequency: frequency,
                vendorRateType: rateType,
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
                vendorPaymentFrequency: frequency,
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
                vendorPaymentFrequency: frequency,
                vendorRateType: rateType,
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

    const handleAssignNightManager = async (nm: { uid: string; displayName: string }) => {
        if (!wo || !profile) return;
        setAssigningNm(true);
        try {
            // Optimistic update
            setWo({ ...wo, assignedNightManagerId: nm.uid, assignedNightManagerName: nm.displayName });
            setShowNmDropdown(false);

            await updateDoc(doc(db, 'work_orders', wo.id), {
                assignedNightManagerId: nm.uid,
                assignedNightManagerName: nm.displayName,
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'NIGHT_MANAGER_ASSIGNED',
                workOrderId: wo.id,
                nightManagerId: nm.uid,
                nightManagerName: nm.displayName,
                assignedBy: profile.uid || 'unknown',
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Error assigning night manager:', err);
        } finally {
            setAssigningNm(false);
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

    // ─── Signed Scope of Work (SOW) Upload & Management ───
    const [sowUploading, setSowUploading] = useState(false);
    const [sowUploadProgress, setSowUploadProgress] = useState(0);

    const handleSowFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !wo?.id) return;

        setSowUploading(true);
        setSowUploadProgress(0);

        try {
            const storagePath = `work-orders/${wo.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setSowUploadProgress(Math.round(progress));
                },
                (error) => {
                    console.error('SOW Upload error:', error);
                    setSowUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const uploadedAt = new Date().toISOString();

                    await updateDoc(doc(db, 'work_orders', wo.id), {
                        sowDocumentUrl: downloadURL,
                        sowDocumentName: file.name,
                        sowUploadedAt: uploadedAt,
                        updatedAt: serverTimestamp(),
                    });

                    await addDoc(collection(db, 'activity_logs'), {
                        type: 'WORK_ORDER_SOW_UPLOADED',
                        workOrderId: wo.id,
                        fileName: file.name,
                        uploadedBy: profile?.uid || profile?.email || 'unknown',
                        createdAt: serverTimestamp(),
                    });

                    setWo((prev) => prev ? {
                        ...prev,
                        sowDocumentUrl: downloadURL,
                        sowDocumentName: file.name,
                        sowUploadedAt: uploadedAt,
                    } : null);

                    setSowUploading(false);
                }
            );
        } catch (err) {
            console.error('Error uploading SOW:', err);
            setSowUploading(false);
        }
    };

    const handleRemoveSow = async () => {
        if (!wo?.id || !confirm('Are you sure you want to remove this signed SOW document?')) return;
        try {
            await updateDoc(doc(db, 'work_orders', wo.id), {
                sowDocumentUrl: null,
                sowDocumentName: null,
                sowUploadedAt: null,
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'activity_logs'), {
                type: 'WORK_ORDER_SOW_REMOVED',
                workOrderId: wo.id,
                leadId: (wo as any).leadId || null,
                createdBy: profile?.uid || 'unknown',
                createdAt: serverTimestamp(),
            });

            setWo((prev) => prev ? {
                ...prev,
                sowDocumentUrl: undefined,
                sowDocumentName: undefined,
                sowUploadedAt: undefined,
            } : null);
        } catch (err) {
            console.error('Error removing SOW:', err);
        }
    };

    const handleDeleteWorkOrder = async () => {
        if (!wo?.id) return;
        if (!confirm(`Are you sure you want to permanently delete Work Order #${wo.id.slice(0, 8)} (${wo.serviceType})? This action cannot be undone.`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'work_orders', wo.id));
            await addDoc(collection(db, 'activity_logs'), {
                type: 'WORK_ORDER_DELETED',
                workOrderId: wo.id,
                serviceType: wo.serviceType,
                leadId: (wo as any).leadId || null,
                deletedBy: profile?.uid || 'unknown',
                createdAt: serverTimestamp(),
            });
            router.push('/operations/work-orders');
        } catch (err) {
            console.error('Error deleting work order:', err);
            alert('Failed to delete work order.');
        }
    };

    if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
    if (!wo) return <div className="p-8 flex justify-center">Work order not found</div>;

    const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.pending_assignment;
    const margin = wo.vendorRate ? wo.clientRate - wo.vendorRate : null;
    const marginPercent = margin !== null && wo.clientRate > 0 ? Math.round((margin / wo.clientRate) * 100) : null;
    const isOneTime = wo.schedule?.frequency === 'one_time' || (wo as any).frequency === 'one_time' || (wo as any).billingType === 'one_time';
    const filteredVendors = vendors.filter(v =>
        v.companyName?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.contactName?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.services?.some(s => s.toLowerCase().includes(vendorSearch.toLowerCase())) ||
        v.zipCode?.includes(vendorSearch)
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
                            {(() => {
                                const start = (wo as any).serviceStartDate;
                                if (!start) return null;
                                const startDate = typeof start === 'string' ? new Date(start) : (start.toDate?.() || new Date(start));
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                startDate.setHours(0, 0, 0, 0);
                                const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (daysUntil > 0) {
                                    return (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                            Starts in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                                        </Badge>
                                    );
                                }
                                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Service active</Badge>;
                            })()}
                        </h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {wo.locationName}
                        </p>
                        {(wo.locationAddress || wo.locationCity) && (
                            <p className="text-xs text-muted-foreground ml-5">
                                {[wo.locationAddress, wo.locationCity, wo.locationState, wo.locationZip].filter(Boolean).join(', ')}
                            </p>
                        )}
                        {/* Vendor sourcing countdown alert */}
                        {(() => {
                            const start = (wo as any).serviceStartDate;
                            if (!start || wo.vendorId) return null;
                            const startDate = typeof start === 'string' ? new Date(start) : (start.toDate?.() || new Date(start));
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            startDate.setHours(0, 0, 0, 0);
                            const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysUntil > 0) {
                                return (
                                    <div className="mt-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span><strong>{daysUntil} day{daysUntil !== 1 ? 's' : ''}</strong> to find a vendor before service starts on <strong>{startDate.toLocaleDateString()}</strong></span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>

                {/* Status Actions */}
                <div className="flex gap-2 items-center">
                    {(wo.sowDocumentUrl || sowDoc?.url) && (
                        <a
                            href={wo.sowDocumentUrl || sowDoc?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                        >
                            <FileCheck className="w-3.5 h-3.5" /> View SOW (PDF) <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                        </a>
                    )}
                    {quoteId && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/sales/quotes/${quoteId}`)}>
                            <Pencil className="w-3.5 h-3.5" /> Revise Quote
                        </Button>
                    )}
                    {wo.status === 'scheduled' && (
                        <>
                            <Button variant="outline" size="sm" className="gap-2 border-green-300 text-green-700 hover:bg-green-50 font-semibold" onClick={() => handleStatusChange('active')}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Start Service
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleStatusChange('paused')}>
                                <Clock className="w-3.5 h-3.5" /> Pause
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => handleStatusChange('completed')}>
                                Complete
                            </Button>
                        </>
                    )}
                    {wo.status === 'active' && (
                        <>
                            <Button variant="outline" size="sm" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleStatusChange('paused')}>
                                <Clock className="w-3.5 h-3.5" /> Pause
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2 border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleStatusChange('completed')}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                            </Button>
                        </>
                    )}
                    {wo.status === 'paused' && (
                        <>
                            <Button variant="outline" size="sm" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => handleStatusChange(isOneTime && wo.scheduledDate ? 'scheduled' : 'active')}>
                                {isOneTime ? 'Resume Schedule' : 'Resume'}
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2 border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleStatusChange('completed')}>
                                Complete
                            </Button>
                        </>
                    )}
                    {wo.status === 'completed' && (
                        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => handleStatusChange(isOneTime ? 'scheduled' : 'active')}>
                            Re-open Work Order
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                        onClick={handleDeleteWorkOrder}
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Overview */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">{isOneTime ? 'Client Rate (One-Time)' : 'Client Rate'}</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(wo.clientRate)}<span className="text-xs font-normal text-muted-foreground ml-1">{isOneTime ? 'total' : '/mo'}</span></p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">{isOneTime ? 'Vendor Rate (One-Time)' : 'Vendor Rate'}</p>
                                <p className="text-2xl font-bold">
                                    {wo.vendorRate ? formatCurrency(wo.vendorRate) : <span className="text-muted-foreground">—</span>}
                                    {wo.vendorRate && <span className="text-xs font-normal text-muted-foreground ml-1">{isOneTime ? 'total' : '/mo'}</span>}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-xs text-muted-foreground uppercase">{isOneTime ? 'Project Margin' : 'Monthly Margin'}</p>
                                <p className={`text-2xl font-bold ${margin !== null ? (margin > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                                    {margin !== null ? formatCurrency(margin) : <span className="text-muted-foreground">—</span>}
                                    {margin !== null && marginPercent !== null && (
                                        <span className="text-xs font-normal text-muted-foreground ml-1">({marginPercent}%)</span>
                                    )}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Signed Scope of Work Document Card */}
                    <Card className="border-slate-300 dark:border-slate-800 shadow-xs">
                        <CardHeader className="pb-3 border-b bg-slate-50/60 dark:bg-slate-900/30">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileCheck className="w-5 h-5 text-blue-600" />
                                        Signed Scope of Work (SOW) & Agreement
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Official client-signed agreement and scope documentation for this work order.
                                    </CardDescription>
                                </div>
                                {(wo.sowDocumentUrl || sowDoc?.url) && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> SOW Attached
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <input
                                type="file"
                                ref={sowFileInputRef}
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={handleUploadSowFile}
                            />

                            {uploadingSow && (
                                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-xs space-y-2">
                                    <div className="flex justify-between font-semibold text-blue-900">
                                        <span>Uploading signed SOW document...</span>
                                        <span>{sowProgress}%</span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                        <div className="bg-blue-600 h-2 transition-all duration-300" style={{ width: `${sowProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            {(wo.sowDocumentUrl || sowDoc?.url) ? (
                                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-950">
                                                {wo.sowDocumentName || sowDoc?.name || 'Signed_Statement_of_Work.pdf'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Executed SOW Document • Linked to Operations & Vendor Dispatch
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                                            onClick={() => window.open(wo.sowDocumentUrl || sowDoc?.url, '_blank')}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" /> View Signed SOW (PDF)
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 text-xs text-slate-700"
                                            disabled={uploadingSow}
                                            onClick={() => sowFileInputRef.current?.click()}
                                        >
                                            <Upload className="w-3.5 h-3.5" /> Replace
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-destructive hover:bg-destructive/10"
                                            onClick={handleRemoveSowFile}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center space-y-2 bg-slate-50/40">
                                    <p className="text-xs text-muted-foreground">
                                        No signed SOW document currently attached to this work order.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-xs"
                                        disabled={uploadingSow}
                                        onClick={() => sowFileInputRef.current?.click()}
                                    >
                                        <Upload className="w-3.5 h-3.5 text-blue-600" /> Upload Signed SOW (PDF)
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Schedule */}
                    <Card className={isOneTime ? "border-indigo-200 bg-indigo-50/10 shadow-2xs" : ""}>
                        <CardHeader className="pb-3 border-b bg-muted/20">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    {isOneTime ? 'Project Execution Date & Schedule' : 'Recurring Service Schedule'}
                                </CardTitle>
                                {isOneTime && (
                                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                                        One-Time Project
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {isOneTime ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {/* Scheduled Date Input / Display */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Scheduled Execution Date
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="date"
                                                    value={scheduledDateVal}
                                                    onChange={(e) => setScheduledDateVal(e.target.value)}
                                                    className="h-9 text-sm font-medium bg-background"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleSaveScheduleDate}
                                                    disabled={savingSchedule || !scheduledDateVal || scheduledDateVal === (wo.scheduledDate || '')}
                                                    className="h-9 text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0"
                                                >
                                                    {savingSchedule ? 'Saving...' : 'Save Date'}
                                                </Button>
                                            </div>
                                            {wo.scheduledDate && (
                                                <p className="text-xs text-indigo-900 font-medium pt-0.5">
                                                    📅 Scheduled for: <strong>{new Date(wo.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                                                </p>
                                            )}
                                        </div>

                                        {/* Service Window */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-indigo-600" /> Service Window / Time
                                            </Label>
                                            <Input
                                                type="time"
                                                value={scheduledTimeVal}
                                                onChange={(e) => setScheduledTimeVal(e.target.value)}
                                                onBlur={handleSaveScheduleDate}
                                                className="h-9 text-sm bg-background"
                                            />
                                        </div>
                                    </div>

                                    {/* Status Switcher Bar for One-Time Work Orders */}
                                    <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 flex items-center justify-between flex-wrap gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-indigo-950">Current Status:</span>
                                            <Badge variant={config.variant} className="font-bold">
                                                {config.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-muted-foreground mr-1">Mark as:</span>
                                            {wo.status !== 'scheduled' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleStatusChange('scheduled')}
                                                >
                                                    📅 Scheduled
                                                </Button>
                                            )}
                                            {wo.status !== 'active' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-2.5 border-green-300 text-green-700 hover:bg-green-50"
                                                    onClick={() => handleStatusChange('active')}
                                                >
                                                    ⚡ Active / In-Progress
                                                </Button>
                                            )}
                                            {wo.status !== 'paused' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-2.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                                                    onClick={() => handleStatusChange('paused')}
                                                >
                                                    ⏸️ Paused / On Hold
                                                </Button>
                                            )}
                                            {wo.status !== 'completed' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-2.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                                                    onClick={() => handleStatusChange('completed')}
                                                >
                                                    ✅ Completed
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Frequency</p>
                                        <p className="font-medium">{formatFrequency(wo.schedule?.frequency, wo.schedule?.daysOfWeek)}</p>
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
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Task Checklist — grouped by room */}
                    {wo.tasks && wo.tasks.length > 0 && (() => {
                        // Group tasks by roomName (fall back to 'General Tasks' for legacy flat tasks)
                        const roomGroups: { roomName: string; tasks: typeof wo.tasks }[] = [];
                        for (const task of wo.tasks) {
                            const rn = (task as any).roomName || 'General Tasks';
                            const existing = roomGroups.find(g => g.roomName === rn);
                            if (existing) {
                                existing.tasks.push(task);
                            } else {
                                roomGroups.push({ roomName: rn, tasks: [task] });
                            }
                        }

                        return (
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-muted-foreground" /> Task Checklist
                                            </CardTitle>
                                            <CardDescription>{wo.tasks.length} tasks across {roomGroups.length} {roomGroups.length === 1 ? 'area' : 'areas'}</CardDescription>
                                        </div>
                                        <Link href={`/operations/nfc-zones?woId=${params.id}`}>
                                            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                                <Package className="w-3.5 h-3.5" />
                                                {wo.nfcZones && wo.nfcZones.length > 0 ? 'Edit NFC Zones' : 'Setup NFC Zones'}
                                            </Button>
                                        </Link>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {roomGroups.map((group) => (
                                        <div key={group.roomName}>
                                            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border/50">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.roomName}</span>
                                                <span className="text-[10px] text-muted-foreground/60">({group.tasks.length})</span>
                                            </div>
                                            <div className="space-y-1 ml-1">
                                                {group.tasks.map((task, i) => (
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
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        );
                    })()}

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
                                                    {formatCurrency(v.vendorRate)}{isOneTime ? ' total' : '/mo'} •
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
                    <Card className="border-slate-200 dark:border-slate-800 shadow-2xs">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/30">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <User2 className="w-4 h-4 text-muted-foreground" /> Assigned Vendor
                                </span>
                                {wo.vendorId && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                        Assigned
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {wo.vendorId ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-semibold text-base text-foreground">
                                            {wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Assigned'}
                                        </p>
                                        <p className="text-sm font-medium text-emerald-600">
                                            Agreed Rate: {formatCurrency(wo.vendorRate!)}{isOneTime ? ' total' : '/mo'}
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 text-xs"
                                        onClick={() => setShowAssign(true)}
                                    >
                                        <Truck className="w-3.5 h-3.5" /> Replace Vendor
                                    </Button>

                                    {/* Contractor SOW / Subcontractor Rate Agreement */}
                                    <div className="pt-3 border-t space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                <FileCheck className="w-3.5 h-3.5 text-blue-600" /> Contractor SOW & Rate
                                            </p>
                                            {wo.contractorSowUrl && (
                                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                                                    Rate Confirmed
                                                </Badge>
                                            )}
                                        </div>

                                        <input
                                            type="file"
                                            ref={contractorSowFileInputRef}
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            className="hidden"
                                            onChange={handleUploadContractorSow}
                                        />

                                        {uploadingContractorSow && (
                                            <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs space-y-1.5">
                                                <div className="flex justify-between font-semibold text-blue-900">
                                                    <span>Uploading Contractor SOW...</span>
                                                    <span>{contractorSowProgress}%</span>
                                                </div>
                                                <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-blue-600 h-1.5 transition-all duration-300" style={{ width: `${contractorSowProgress}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        {wo.contractorSowUrl ? (
                                            <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                                                    <p className="text-xs font-medium text-emerald-950 truncate">
                                                        {wo.contractorSowName || 'Contractor_Signed_SOW.pdf'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-xs gap-1 bg-emerald-700 hover:bg-emerald-800 text-white flex-1"
                                                        onClick={() => window.open(wo.contractorSowUrl, '_blank')}
                                                    >
                                                        <ExternalLink className="w-3 h-3" /> View SOW (PDF)
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs px-2 text-slate-700"
                                                        disabled={uploadingContractorSow}
                                                        onClick={() => contractorSowFileInputRef.current?.click()}
                                                    >
                                                        <Upload className="w-3 h-3" /> Replace
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={handleRemoveContractorSow}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50 space-y-1.5">
                                                <p className="text-[11px] text-muted-foreground">
                                                    Upload contractor-signed SOW / rate confirmation
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1.5 w-full text-blue-700 border-blue-200 hover:bg-blue-50"
                                                    disabled={uploadingContractorSow}
                                                    onClick={() => contractorSowFileInputRef.current?.click()}
                                                >
                                                    <Upload className="w-3 h-3" /> Upload Contractor SOW (PDF)
                                                </Button>
                                            </div>
                                        )}
                                    </div>
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

                    {/* Night Manager Assignment */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Moon className="w-4 h-4 text-muted-foreground" /> Night Manager
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative" ref={nmDropdownRef}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`w-full gap-2 justify-between ${(wo as any).assignedNightManagerName ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50' : ''}`}
                                    onClick={() => setShowNmDropdown(!showNmDropdown)}
                                    disabled={assigningNm}
                                >
                                    <span className="flex items-center gap-2">
                                        <Moon className="w-4 h-4" />
                                        {(wo as any).assignedNightManagerName || 'Assign Night Manager'}
                                    </span>
                                    {(wo as any).assignedNightManagerName && <span className="text-xs text-muted-foreground">✎</span>}
                                </Button>
                                {showNmDropdown && (
                                    <div className="absolute left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl z-50 py-1">
                                        {nmUsers.length === 0 ? (
                                            <p className="text-xs text-muted-foreground p-3">No Night Manager users found</p>
                                        ) : (
                                            nmUsers.map(nm => (
                                                <button
                                                    key={nm.uid}
                                                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                                                    onClick={() => handleAssignNightManager(nm)}
                                                >
                                                    <span>{nm.displayName}</span>
                                                    {(wo as any).assignedNightManagerId === nm.uid && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
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
                                    {wo.serviceType} at {wo.locationName} • Client rate: {formatCurrency(wo.clientRate)}{isOneTime ? ' total (One-Time)' : '/mo'}
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
                                        No approved vendors found. Vendors must be approved or onboarded before assignment.
                                    </p>
                                ) : (
                                    filteredVendors.map((v) => (
                                        <Card
                                            key={v.id}
                                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedVendor?.id === v.id ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                            onClick={() => setSelectedVendor(v)}
                                        >
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-sm">{v.companyName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {v.contactName}{v.city ? ` • ${v.city}${v.state ? `, ${v.state}` : ''}` : ''}{v.zipCode ? ` • ${v.zipCode}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {v.capabilityMatch && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                                                                <CheckCircle2 className="w-3 h-3" /> Service
                                                            </span>
                                                        )}
                                                        {v.locationMatch && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                                                <MapPin className="w-3 h-3" /> Area
                                                            </span>
                                                        )}
                                                        {selectedVendor?.id === v.id && (
                                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                                {v.services.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {v.services.slice(0, 5).map((s, i) => (
                                                            <span
                                                                key={i}
                                                                className={`px-1.5 py-0.5 rounded text-[10px] ${wo.serviceType?.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(wo.serviceType?.toLowerCase() || '')
                                                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                                                                    : 'bg-muted text-muted-foreground'
                                                                    }`}
                                                            >
                                                                {s}
                                                            </span>
                                                        ))}
                                                        {v.services.length > 5 && (
                                                            <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">+{v.services.length - 5} more</span>
                                                        )}
                                                    </div>
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
                                        <Label className="text-sm">Vendor {isOneTime ? 'One-Time' : 'Monthly'} Rate ($)</Label>
                                        <div className="relative mt-1">
                                            <DollarSign className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                placeholder={isOneTime ? 'e.g. 500' : 'e.g. 1800'}
                                                className="pl-8"
                                                value={vendorRate || ''}
                                                onChange={(e) => setVendorRate(parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>

                                    {vendorRate > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                                            <span className="text-sm text-muted-foreground">Projected {isOneTime ? 'Total Project' : 'Monthly'} Margin:</span>
                                            <span className={`text-lg font-bold ${wo.clientRate - vendorRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(wo.clientRate - vendorRate)}
                                                {wo.clientRate > 0 && (
                                                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                                                        ({Math.round(((wo.clientRate - vendorRate) / wo.clientRate) * 100)}%)
                                                    </span>
                                                )}
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
