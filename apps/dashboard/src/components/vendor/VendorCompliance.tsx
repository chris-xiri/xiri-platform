'use client';

import React, { useState } from 'react';
import { Vendor } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
    Building2, Shield, Users, Car, Droplet, FileText, AlertTriangle,
    Download, ExternalLink, Upload, Loader2, History, Plus
} from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getInsuranceStatusInfo } from '../VendorList/utils';

interface VendorComplianceProps {
    vendor: Vendor;
}

export default function VendorCompliance({ vendor }: VendorComplianceProps) {
    const compliance = vendor.compliance;
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    const insuranceInfo = getInsuranceStatusInfo(vendor);

    if (!compliance) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    This vendor has not completed the onboarding form yet.
                </AlertDescription>
            </Alert>
        );
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !vendor.id) return;

        setUploading(true);
        setUploadProgress(0);
        setUploadMessage("Uploading document to storage...");

        try {
            const storagePath = `acord25/${vendor.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(Math.round(progress));
                },
                (error) => {
                    console.error('Upload error:', error);
                    setUploadMessage(`Upload failed: ${error.message}`);
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploadMessage("Triggering AI Document Verification...");

                    const docRecord = {
                        id: `doc_${Date.now()}`,
                        fileName: file.name,
                        url: downloadURL,
                        uploadedAt: new Date().toISOString(),
                        status: 'PENDING'
                    };

                    // Update primary acord25 trigger AND document history array
                    const vendorRef = doc(db, "vendors", vendor.id);
                    await updateDoc(vendorRef, {
                        'compliance.acord25': {
                            status: 'PENDING',
                            url: downloadURL,
                            uploadedAt: serverTimestamp(),
                            fileName: file.name
                        },
                        'compliance.documentsHistory': arrayUnion(docRecord),
                        updatedAt: serverTimestamp()
                    });

                    setUploadMessage("✅ Document uploaded & queued for AI Verification!");
                    setTimeout(() => {
                        setUploading(false);
                        setUploadMessage(null);
                    }, 3000);
                }
            );
        } catch (err: any) {
            console.error(err);
            setUploadMessage(`Error: ${err.message}`);
            setUploading(false);
        }
    };

    // Calculate compliance score
    const requirements = [
        compliance.hasBusinessEntity,
        compliance.generalLiability?.hasInsurance,
        compliance.workersComp?.hasInsurance,
        compliance.autoInsurance?.hasInsurance,
    ];

    const metRequirements = requirements.filter(Boolean).length;
    const totalRequirements = requirements.length;
    const complianceScore = Math.round((metRequirements / totalRequirements) * 100);

    // Derive insurance coverage from AI-extracted ACORD data when available
    const acordExtracted = (compliance as any).acord25?.extractedData;
    const hasAcordAnalysis = !!acordExtracted;

    const getInsuranceStatus = (coverageField: any, acordActive: boolean | undefined) => {
        if (hasAcordAnalysis && acordActive !== undefined) {
            return { value: acordActive, verified: true, notFound: !acordActive };
        }
        return { value: coverageField?.hasInsurance, verified: coverageField?.verified, notFound: false };
    };

    const glStatus = getInsuranceStatus(compliance.generalLiability, acordExtracted?.glActive);
    const wcStatus = getInsuranceStatus(compliance.workersComp, acordExtracted?.wcActive);
    const autoStatus = getInsuranceStatus(compliance.autoInsurance, acordExtracted?.autoActive);

    const CompactItem = ({ icon: Icon, label, value, verified, notFound, required }: any) => (
        <div className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors text-sm">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
                {required && <span className="text-[10px] text-red-500 font-semibold">*</span>}
            </div>
            <div className="flex items-center gap-2">
                {verified !== undefined && (
                    <Badge
                        variant={verified && value ? "outline" : "secondary"}
                        className={`text-[10px] h-5 px-1.5 font-normal ${
                            notFound ? 'bg-red-100 text-red-700 border-red-200' :
                            verified && value ? 'bg-green-100 text-green-700 border-green-200' : ''
                        }`}
                    >
                        {notFound ? "Not Found" : verified ? "Verified" : "Pending"}
                    </Badge>
                )}
                {value ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                )}
            </div>
        </div>
    );

    const acord25 = compliance.acord25 as any;
    const documentsHistory = (compliance as any).documentsHistory || [];

    return (
        <div className="space-y-4">
            {/* Dedicated Insurance Health & Re-activation Banner */}
            {insuranceInfo.isFullyInsured ? (
                <div className="p-3.5 rounded-xl border bg-emerald-50/90 border-emerald-200 text-emerald-900 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 font-bold text-base">
                            🛡️
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-950">Fully Insured & Active Status</p>
                            <p className="text-xs text-emerald-800">Verified active COI on file. This vendor is eligible for immediate job dispatch.</p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 text-xs shrink-0">🛡️ Fully Insured (Green)</Badge>
                </div>
            ) : insuranceInfo.isExpired ? (
                <div className="p-4 rounded-xl border bg-amber-50 border-amber-300 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 font-bold text-base mt-0.5">
                            ⚠️
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-950">Insurance Policy Expired — Re-activation Action Required</p>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                This vendor previously had insurance, but their policy expired {insuranceInfo.expirationDate ? `on ${new Date(insuranceInfo.expirationDate).toLocaleDateString()}` : ''}.
                                <strong className="block mt-1 text-amber-950">To restore to Fully Insured (Green) status:</strong> Upload an updated COI document below.
                            </p>
                        </div>
                    </div>
                    <label className="cursor-pointer shrink-0">
                        <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 h-9 px-4 text-xs shadow-md" disabled={uploading} asChild>
                            <span>
                                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                Upload COI to Restore Green
                            </span>
                        </Button>
                    </label>
                </div>
            ) : insuranceInfo.isBlocked ? (
                <div className="p-3.5 rounded-xl border bg-red-50 border-red-200 text-red-900 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-700 shrink-0 font-bold text-base">
                            ⛔
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-950">Dispatch Blocked</p>
                            <p className="text-xs text-red-800">Compliance failure or rejected COI document prevents dispatch assignments.</p>
                        </div>
                    </div>
                    <Badge variant="destructive" className="font-bold px-3 py-1 text-xs shrink-0">⛔ Blocked</Badge>
                </div>
            ) : null}

            {/* Header / Actions & Score */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/30 p-3 rounded-lg border gap-3">
                <div>
                    <h3 className="font-semibold text-sm">Compliance Score</h3>
                    <p className="text-xs text-muted-foreground">{metRequirements}/{totalRequirements} Requirements Met</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xl font-bold ${complianceScore === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {complianceScore}%
                    </span>
                    <Badge variant={complianceScore === 100 ? "default" : "outline"}>
                        {complianceScore === 100 ? "Compliant" : "Review"}
                    </Badge>

                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                        <Button size="sm" variant="default" className="gap-1.5 text-xs h-8" disabled={uploading} asChild>
                            <span>
                                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                Upload Insurance Doc
                            </span>
                        </Button>
                    </label>
                </div>
            </div>

            {uploadMessage && (
                <div className="p-2.5 rounded-lg border bg-blue-50 text-blue-800 text-xs flex items-center justify-between">
                    <span className="font-medium">{uploadMessage}</span>
                    {uploading && <span className="font-bold">{uploadProgress}%</span>}
                </div>
            )}

            {/* Active ACORD 25 Document Status */}
            {(acord25?.url || acord25?.status || acord25?.extractedData) && (
                <div className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${acord25.status === 'FLAGGED' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                {acord25.status === 'FLAGGED' ? <AlertTriangle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium">ACORD 25 — Active Certificate of Insurance</p>
                                {acord25.extractedData?.insuredName && (
                                    <p className="text-xs text-muted-foreground">{acord25.extractedData.insuredName}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {acord25.uploadedAt?.toDate ? `Uploaded ${acord25.uploadedAt.toDate().toLocaleDateString()}` : 
                                     acord25.verifiedAt?.toDate ? `Verified ${acord25.verifiedAt.toDate().toLocaleDateString()}` : 'Uploaded'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={acord25.status === 'VERIFIED' ? 'default' : 'outline'}
                                className={
                                    acord25.status === 'VERIFIED' ? 'bg-green-600' : 
                                    acord25.status === 'FLAGGED' ? 'border-yellow-400 text-yellow-700' :
                                    acord25.status === 'REJECTED' ? 'border-red-400 text-red-600' : ''
                                }
                            >
                                {acord25.status || 'PENDING'}
                            </Badge>
                            {acord25.url ? (
                                <a
                                    href={acord25.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View PDF
                                </a>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">PDF link missing</span>
                            )}
                        </div>
                    </div>
                    {acord25.aiAnalysis?.reasoning && (
                        <div className={`mt-2 p-2 rounded text-xs ${acord25.status === 'FLAGGED' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-muted/50'}`}>
                            <span className="font-medium">AI Analysis: </span>{acord25.aiAnalysis.reasoning}
                        </div>
                    )}
                </div>
            )}

            {/* Document History Array */}
            {documentsHistory.length > 0 && (
                <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <History className="w-3.5 h-3.5" />
                        Insurance Document Upload History ({documentsHistory.length})
                    </div>
                    <div className="space-y-1.5">
                        {documentsHistory.slice().reverse().map((docItem: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/20 text-xs">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium text-foreground">{docItem.fileName || `Insurance Doc #${documentsHistory.length - idx}`}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Uploaded: {docItem.uploadedAt ? new Date(docItem.uploadedAt).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px]">
                                        {docItem.status || 'PROCESSED'}
                                    </Badge>
                                    <a
                                        href={docItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1 font-medium"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        PDF
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Core Legal */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legal & Structure</h4>
                    <CompactItem
                        icon={Building2}
                        label="Business Entity"
                        value={compliance.hasBusinessEntity}
                        required={true}
                    />
                    <CompactItem
                        icon={FileText}
                        label="W-9 Form"
                        value={compliance.w9Collected}
                    />
                </div>

                {/* Column 2: Insurance */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Insurance Coverage</h4>
                    <CompactItem
                        icon={Shield}
                        label="General Liability"
                        value={glStatus.value}
                        verified={glStatus.verified}
                        notFound={glStatus.notFound}
                        required={true}
                    />
                    <CompactItem
                        icon={Users}
                        label="Workers' Comp"
                        value={wcStatus.value}
                        verified={wcStatus.verified}
                        notFound={wcStatus.notFound}
                        required={true}
                    />
                    <CompactItem
                        icon={Car}
                        label="Commercial Auto"
                        value={autoStatus.value}
                        verified={autoStatus.verified}
                        notFound={autoStatus.notFound}
                    />
                    {compliance.additionalInsurance?.map((ins: any, idx: number) => (
                        <CompactItem
                            key={idx}
                            icon={Droplet}
                            label={ins.type}
                            value={ins.hasInsurance}
                            verified={ins.verified}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

