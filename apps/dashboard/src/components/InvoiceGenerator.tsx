'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkOrder, InvoiceLineItem, VendorPayout, getTaxRate, calculateTax, isEligibleForST120 } from '@xiri/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, X, CheckCircle2, Building2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    onCreated: (id: string) => void;
}

interface ClientGroup {
    leadId: string;
    businessName: string;
    contractId?: string;
    workOrders: (WorkOrder & { id: string })[];
}

export default function InvoiceGenerator({ onClose, onCreated }: Props) {
    const { profile } = useAuth();
    const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientGroup | null>(null);
    const [billingStart, setBillingStart] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [billingEnd, setBillingEnd] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-25`;
    });
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        async function fetchActiveWOs() {
            try {
                const q = query(collection(db, 'work_orders'), where('status', '==', 'active'));
                const snap = await getDocs(q);
                const wos = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkOrder & { id: string }));

                // Filter out WOs whose service hasn't started by the billing period
                const billingEndDate = billingEnd + '-31'; // last day of billing month
                const billableWOs = wos.filter(wo => {
                    const start = (wo as any).serviceStartDate;
                    if (!start) return true; // backwards compatible — no start date means already active
                    const startStr = typeof start === 'string' ? start : (start.toDate?.() || new Date(start)).toISOString().split('T')[0];
                    return startStr <= billingEndDate;
                });

                // Group by lead
                const groups: Record<string, ClientGroup> = {};
                // Fetch lead names
                const leadIds = [...new Set(wos.map(wo => wo.leadId))];
                const leadNames: Record<string, string> = {};
                for (const lid of leadIds) {
                    try {
                        const { getDoc, doc: fbDoc } = await import('firebase/firestore');
                        const leadSnap = await getDoc(fbDoc(db, 'leads', lid));
                        if (leadSnap.exists()) {
                            leadNames[lid] = leadSnap.data().businessName || leadSnap.data().contactName || lid;
                        }
                    } catch { /* skip */ }
                }

                for (const wo of billableWOs) {
                    if (!groups[wo.leadId]) {
                        groups[wo.leadId] = {
                            leadId: wo.leadId,
                            businessName: leadNames[wo.leadId] || wo.leadId,
                            contractId: wo.contractId,
                            workOrders: [],
                        };
                    }
                    groups[wo.leadId].workOrders.push(wo);
                }

                setClientGroups(Object.values(groups));
            } catch (err) {
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchActiveWOs();
    }, []);

    // Auto-update due date to the 25th of the billing month when billing period changes
    useEffect(() => {
        if (billingStart) {
            const [year, month] = billingStart.split('-');
            setDueDate(`${year}-${month}-25`);
        }
    }, [billingStart]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    // Build line items + vendor payouts from selected client
    const lineItems: InvoiceLineItem[] = selectedClient
        ? selectedClient.workOrders.map(wo => {
            const zip = wo.locationZip || '';
            const taxInfo = zip ? getTaxRate(zip) : null;
            const taxRate = taxInfo?.combinedRate || 0;
            const taxAmount = calculateTax(wo.clientRate || 0, taxRate);
            return {
                workOrderId: wo.id || '',
                locationName: wo.locationName || '',
                locationAddress: [wo.locationAddress, wo.locationCity, wo.locationState, wo.locationZip].filter(Boolean).join(', ') || '',
                locationZip: zip,
                serviceType: wo.serviceType || '',
                frequency: wo.schedule?.frequency || 'monthly',
                amount: wo.clientRate || 0,
                taxRate: taxRate,
                taxAmount: taxAmount,
            };
        })
        : [];

    const vendorPayouts: VendorPayout[] = selectedClient
        ? selectedClient.workOrders
            .filter(wo => wo.vendorId && wo.vendorRate)
            .map(wo => ({
                vendorId: wo.vendorId || '',
                vendorName: wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Vendor',
                workOrderId: wo.id || '',
                serviceType: wo.serviceType || '',
                amount: wo.vendorRate || 0,
                status: 'pending' as const,
            }))
        : [];

    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const totalTax = lineItems.reduce((sum, li) => sum + (li.taxAmount || 0), 0);
    const totalPayouts = vendorPayouts.reduce((sum, vp) => sum + vp.amount, 0);
    const grossMargin = subtotal + totalTax - totalPayouts;

    const handleCreate = async () => {
        if (!selectedClient || !profile) return;
        setCreating(true);

        try {
            const userId = profile.uid || profile.email || 'unknown';
            const paymentToken = crypto.randomUUID();

            const docRef = await addDoc(collection(db, 'invoices'), {
                leadId: selectedClient.leadId,
                clientBusinessName: selectedClient.businessName,
                contractId: selectedClient.contractId || null,
                lineItems,
                subtotal,
                totalTax: totalTax || 0,
                adjustments: 0,
                totalAmount: subtotal + totalTax,
                vendorPayouts,
                totalPayouts,
                grossMargin,
                billingPeriod: { start: billingStart, end: billingEnd },
                dueDate: new Date(dueDate),
                paymentToken,
                status: 'draft',
                createdBy: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Auto-generate Vendor Remittance Statements — one per vendor
            const vendorGroups: Record<string, { vendorName: string; workOrders: (WorkOrder & { id: string })[] }> = {};
            for (const wo of selectedClient.workOrders) {
                if (wo.vendorId && wo.vendorRate) {
                    if (!vendorGroups[wo.vendorId]) {
                        vendorGroups[wo.vendorId] = {
                            vendorName: wo.vendorHistory?.[wo.vendorHistory.length - 1]?.vendorName || 'Vendor',
                            workOrders: [],
                        };
                    }
                    vendorGroups[wo.vendorId].workOrders.push(wo);
                }
            }

            for (const [vendorId, group] of Object.entries(vendorGroups)) {
                // XIRI holds ST-120.1 — all vendor purchases are tax-exempt
                const remLineItems = group.workOrders.map(wo => {
                    const zip = wo.locationZip;
                    const taxInfo = zip ? getTaxRate(zip) : null;
                    const taxRate = taxInfo?.combinedRate || 0;

                    return {
                        workOrderId: wo.id!,
                        locationName: wo.locationName,
                        locationAddress: [wo.locationAddress, wo.locationCity, wo.locationState, wo.locationZip].filter(Boolean).join(', ') || '',
                        locationZip: zip,
                        serviceType: wo.serviceType,
                        frequency: wo.schedule?.frequency || 'monthly',
                        amount: wo.vendorRate!,
                        taxRate: taxRate || 0,
                        taxAmount: 0,               // exempt — XIRI holds ST-120.1
                        taxExempt: true,
                        taxExemptCertificate: 'ST-120.1',
                    };
                });

                const remTotalAmount = remLineItems.reduce((sum, li) => sum + li.amount, 0);

                await addDoc(collection(db, 'vendor_remittances'), {
                    invoiceId: docRef.id,
                    vendorId,
                    vendorName: group.vendorName,
                    lineItems: remLineItems,
                    totalAmount: remTotalAmount,
                    totalTax: 0,                     // all exempt via ST-120.1
                    vendorTaxExemptionStatus: 'on_file', // XIRI's certificate
                    billingPeriod: { start: billingStart, end: billingEnd },
                    dueDate: new Date(dueDate),
                    status: 'pending',
                    createdBy: userId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            await addDoc(collection(db, 'activity_logs'), {
                type: 'INVOICE_CREATED',
                invoiceId: docRef.id,
                clientBusinessName: selectedClient.businessName,
                totalAmount: subtotal,
                grossMargin,
                vendorRemittancesCreated: Object.keys(vendorGroups).length,
                createdBy: userId,
                createdAt: serverTimestamp(),
            });

            onCreated(docRef.id);
        } catch (err) {
            console.error('Error creating invoice:', err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-lg font-bold">Generate Invoice</h2>
                        <p className="text-sm text-muted-foreground">Create a consolidated invoice from active work orders</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {loading ? (
                        <p className="text-center text-sm text-muted-foreground py-8">Loading active clients...</p>
                    ) : (
                        <>
                            {/* Step 1: Select Client */}
                            {!selectedClient ? (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Select Client</Label>
                                    {clientGroups.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">
                                            No active work orders found. Assign vendors to work orders first.
                                        </p>
                                    ) : (
                                        clientGroups.map(cg => (
                                            <Card
                                                key={cg.leadId}
                                                className="cursor-pointer hover:border-primary/50 transition-all"
                                                onClick={() => setSelectedClient(cg)}
                                            >
                                                <CardContent className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Building2 className="w-5 h-5 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">{cg.businessName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {cg.workOrders.length} active work orders
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-medium text-primary">
                                                        {formatCurrency(cg.workOrders.reduce((s, wo) => s + wo.clientRate, 0))}/mo
                                                    </span>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Selected Client */}
                                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">{selectedClient.businessName}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                                            Change
                                        </Button>
                                    </div>

                                    {/* Billing Period */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label className="text-xs">Billing Start</Label>
                                            <Input
                                                type="month"
                                                value={billingStart}
                                                onChange={(e) => setBillingStart(e.target.value)}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Billing End</Label>
                                            <Input
                                                type="month"
                                                value={billingEnd}
                                                onChange={(e) => setBillingEnd(e.target.value)}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Due Date</Label>
                                            <Input
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>

                                    {/* Line Items Preview */}
                                    <div>
                                        <Label className="text-xs mb-2 block">Line Items ({lineItems.length})</Label>
                                        <div className="border rounded-lg divide-y text-sm">
                                            {lineItems.map((li, i) => (
                                                <div key={i} className="px-3 py-2 flex items-center justify-between">
                                                    <div>
                                                        <span className="font-medium">{li.serviceType}</span>
                                                        <span className="text-muted-foreground ml-2 text-xs">{li.locationName}</span>
                                                    </div>
                                                    <span className="font-medium">{formatCurrency(li.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <Card className="bg-muted/30">
                                        <CardContent className="p-4 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span>Client Total</span>
                                                <span className="font-bold">{formatCurrency(subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Vendor Payouts</span>
                                                <span>−{formatCurrency(totalPayouts)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-2">
                                                <span className="font-medium">Gross Margin</span>
                                                <span className={`font-bold ${grossMargin > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {formatCurrency(grossMargin)}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!selectedClient || creating}
                        className="gap-2"
                    >
                        {creating ? 'Creating...' : 'Create Invoice'}
                        <DollarSign className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
