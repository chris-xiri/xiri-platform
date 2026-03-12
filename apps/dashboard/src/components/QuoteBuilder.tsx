'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
    Lead, QuoteLineItem, getTaxRate, calculateTax,
    type RoomScope, type CalculatorInputs, type CalculatorResults, type ProposalTerms,
    CLEANING_TASKS,
} from '@xiri-facility-solutions/shared';

import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import {
    QuoteBuilderProps, Location, STEPS,
    StepSelectClient, StepBuildingScope, StepLocations, StepServicesAndPricing, StepTermsAndSubmit,
    stripUndefined, computeTotals, quoteLogger,
} from './quote-builder';

// ─── Main Orchestrator ────────────────────────────────────────────────
// This component manages state and delegates rendering to step components.

export default function QuoteBuilder({ onClose, onCreated, existingQuote, initialData }: QuoteBuilderProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const isEditing = !!existingQuote;
    const [step, setStep] = useState(isEditing ? 2 : 0);
    const [submitting, setSubmitting] = useState(false);
    const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null);

    // Step 1: Client selection
    const [leads, setLeads] = useState<(Lead & { id: string })[]>([]);
    const [selectedLead, setSelectedLead] = useState<(Lead & { id: string }) | null>(null);

    // Step 1 → Building Scope (calculator-as-scope)
    const [scope, setScope] = useState<{
        rooms: RoomScope[];
        inputs: CalculatorInputs;
        results: CalculatorResults;
        location: Location;
    } | null>(null);

    // Step 2: Locations (from scope or manual)
    const [locations, setLocations] = useState<Location[]>(existingQuote?.locations || []);

    // Step 2: Line items
    const [lineItems, setLineItems] = useState<QuoteLineItem[]>(existingQuote?.lineItems || []);

    // Step 4: Terms
    const [contractTenure, setContractTenure] = useState(existingQuote?.contractTenure || 12);
    const [paymentTerms, setPaymentTerms] = useState(existingQuote?.paymentTerms || 'Pay on the 25th');
    const [exitClause, setExitClause] = useState(existingQuote?.exitClause || '30-day written notice');
    const [notes, setNotes] = useState(existingQuote?.notes || '');
    const [proposalTerms, setProposalTerms] = useState<ProposalTerms | null>(null);
    const [companyData, setCompanyData] = useState<Record<string, any> | null>(null);

    // Commission assignment
    const [assignedTo, setAssignedTo] = useState(profile?.uid || '');
    const [salesUsers, setSalesUsers] = useState<{ uid: string; displayName: string; email: string }[]>([]);

    // ─── Data Fetching ─────────────────────────────────────────────────
    useEffect(() => {
        async function fetchLeads() {
            const snap = await getDocs(query(collection(db, 'leads')));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead & { id: string }));
            setLeads(data);
            if (existingQuote) {
                const match = data.find(l => l.id === existingQuote.leadId);
                if (match) setSelectedLead(match);
            } else if (initialData?.leadId) {
                // Auto-select lead from initialData and skip to step 1
                const match = data.find(l => l.id === initialData.leadId);
                if (match) {
                    handleSelectLead(match);
                    setStep(1);
                }
            }
        }
        fetchLeads();
    }, []);

    useEffect(() => {
        async function fetchSalesUsers() {
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                const sales: { uid: string; displayName: string; email: string }[] = [];
                usersSnap.forEach(d => {
                    const data = d.data();
                    if (data.roles?.includes('sales') || data.roles?.includes('sales_manager') || data.roles?.includes('admin')) {
                        sales.push({ uid: d.id, displayName: data.displayName || data.email, email: data.email });
                    }
                });
                setSalesUsers(sales);
                if (!assignedTo && profile?.uid) setAssignedTo(profile.uid);
            } catch (err) {
                quoteLogger.quoteError('fetchSalesUsers', err);
            }
        }
        fetchSalesUsers();
    }, []);

    // Fetch company data for T&C defaults
    useEffect(() => {
        async function fetchCompanyData() {
            try {
                const companyId = (profile as any)?.companyId;
                if (!companyId) return;
                const companyDoc = await getDoc(doc(db, 'companies', companyId));
                if (companyDoc.exists()) {
                    setCompanyData(companyDoc.data());
                }
            } catch (err) {
                console.warn('Could not fetch company data for T&C defaults:', err);
            }
        }
        fetchCompanyData();
    }, [(profile as any)?.companyId]);

    // When a lead is selected, pre-populate locations
    useEffect(() => {
        if (isEditing && locations.length > 0) return;
        if (selectedLead?.locations && selectedLead.locations.length > 0) {
            const locs = selectedLead.locations.map((loc: any, i: number) => ({
                id: `loc_${i}`, name: loc.name || `Location ${i + 1}`,
                address: loc.address || '', city: loc.city || '', state: loc.state || '', zip: loc.zip || '',
            }));
            setLocations(locs);
            // Pre-fill a line item with rate from initialData (Calculator/Lead Drawer flow)
            if (initialData?.rate && lineItems.length === 0) {
                const userId = profile?.uid || profile?.email || 'unknown';
                setLineItems([{
                    id: `li_${Date.now()}_prefill`,
                    locationId: locs[0].id, locationName: locs[0].name,
                    locationAddress: locs[0].address, locationCity: locs[0].city,
                    locationState: locs[0].state, locationZip: locs[0].zip,
                    serviceType: '', serviceCategory: undefined,
                    frequency: 'custom_days', daysOfWeek: [false, true, true, true, true, true, false],
                    clientRate: initialData.rate,
                    lineItemStatus: 'pending' as const,
                    addedBy: userId, addedByRole: 'sales' as const, isUpsell: false,
                }]);
            }
        } else if (selectedLead) {
            const loc = {
                id: 'loc_0', name: selectedLead.businessName || 'Primary Location',
                address: selectedLead.address || '', city: '', state: '', zip: selectedLead.zipCode || '',
            };
            setLocations([loc]);
            // Pre-fill a line item with rate from initialData
            if (initialData?.rate && lineItems.length === 0) {
                const userId = profile?.uid || profile?.email || 'unknown';
                setLineItems([{
                    id: `li_${Date.now()}_prefill`,
                    locationId: loc.id, locationName: loc.name,
                    locationAddress: loc.address, locationCity: loc.city,
                    locationState: loc.state, locationZip: loc.zip,
                    serviceType: '', serviceCategory: undefined,
                    frequency: 'custom_days', daysOfWeek: [false, true, true, true, true, true, false],
                    clientRate: initialData.rate,
                    lineItemStatus: 'pending' as const,
                    addedBy: userId, addedByRole: 'sales' as const, isUpsell: false,
                }]);
            }
        }
    }, [selectedLead]);

    // ─── Event Handlers ────────────────────────────────────────────────
    async function checkExistingQuote(leadId: string) {
        if (isEditing) { setExistingQuoteId(null); return; }
        try {
            const snap = await getDocs(
                query(collection(db, 'quotes'), where('leadId', '==', leadId), where('status', 'in', ['draft', 'sent', 'accepted']))
            );
            setExistingQuoteId(!snap.empty ? snap.docs[0].id : null);
        } catch { setExistingQuoteId(null); }
    }

    const handleSelectLead = (lead: Lead & { id: string }) => {
        setSelectedLead(lead);
        checkExistingQuote(lead.id);
        quoteLogger.leadSelected(lead.id, lead.businessName || '');
    };

    const addLocation = (loc: Location) => {
        setLocations(prev => [...prev, loc]);
    };

    const removeLocation = (id: string) => {
        setLocations(prev => prev.filter(l => l.id !== id));
        setLineItems(prev => prev.filter(li => li.locationId !== id));
    };

    const addLineItem = (loc: Location) => {
        const userId = profile?.uid || profile?.email || 'unknown';
        const isFsm = profile?.roles?.some((r: string) => r === 'fsm');
        const newItem: QuoteLineItem = {
            id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            locationId: loc.id, locationName: loc.name, locationAddress: loc.address,
            locationCity: loc.city, locationState: loc.state, locationZip: loc.zip,
            serviceType: '', serviceCategory: undefined,
            frequency: 'custom_days', daysOfWeek: [false, true, true, true, true, true, false],
            clientRate: 0,
            lineItemStatus: 'pending' as const,
            addedBy: userId,
            addedByRole: (isFsm ? 'fsm' : 'sales') as 'sales' | 'fsm',
            isUpsell: !!isFsm,
        };
        setLineItems(prev => [...prev, newItem]);
        quoteLogger.lineItemAdded(newItem.id, loc.id);
    };

    const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
        setLineItems(prev => prev.map(li => {
            if (li.id !== id) return li;
            const updated = { ...li, ...updates };
            if (!updated.taxExempt && updated.locationZip) {
                const rate = getTaxRate(updated.locationZip);
                if (rate) {
                    updated.taxRate = rate.combinedRate;
                    updated.taxAmount = calculateTax(updated.clientRate || 0, rate.combinedRate);
                }
            } else if (updated.taxExempt) {
                updated.taxAmount = 0;
            }
            return updated;
        }));
    };

    const removeLineItem = (id: string) => {
        setLineItems(prev => prev.filter(li => li.id !== id));
    };

    // ─── Step Navigation ───────────────────────────────────────────────
    const handleStepChange = (newStep: number) => {
        quoteLogger.stepChange(step, newStep);

        // Auto-generate line items when advancing from Building Scope → Review
        if (step === 1 && newStep === 2 && scope) {
            // Set location from scope
            setLocations([scope.location]);
            // Generate janitorial line item from calculator scope
            const userId = profile?.uid || profile?.email || 'unknown';
            const isFsm = profile?.roles?.some((r: string) => r === 'fsm');
            const scopeTasks = scope.rooms.flatMap(room =>
                room.tasks.map((taskId: string) => {
                    const taskDef = CLEANING_TASKS.find((t: any) => t.id === taskId);
                    return {
                        name: taskDef?.name || taskId,
                        description: taskDef?.description || '',
                        required: true,
                    };
                })
            );
            // Deduplicate tasks by name
            const seen = new Set<string>();
            const uniqueTasks = scopeTasks.filter(t => {
                if (seen.has(t.name)) return false;
                seen.add(t.name);
                return true;
            });

            const janItem: QuoteLineItem = {
                id: `li_${Date.now()}_jan`,
                locationId: scope.location.id,
                locationName: scope.location.name,
                locationAddress: scope.location.address,
                locationCity: scope.location.city,
                locationState: scope.location.state,
                locationZip: scope.location.zip,
                serviceType: 'Janitorial',
                serviceCategory: 'janitorial' as any,
                frequency: 'custom_days',
                daysOfWeek: Array(7).fill(false).map((_, i) => i > 0 && i < 6) as boolean[],
                clientRate: scope.results.totalPricePerMonth,
                sqft: scope.inputs.sqft,
                scopeTasks: uniqueTasks,
                rooms: scope.rooms,
                calculatorInputs: scope.inputs,
                calculatorResults: scope.results,
                lineItemStatus: 'pending' as const,
                addedBy: userId,
                addedByRole: (isFsm ? 'fsm' : 'sales') as 'sales' | 'fsm',
                isUpsell: false,
            };

            // Replace any existing pre-filled janitorial item, keep other line items
            setLineItems(prev => {
                const nonJan = prev.filter(li => li.serviceType !== 'Janitorial' || !li.rooms);
                return [janItem, ...nonJan];
            });
        }

        setStep(newStep);
    };

    const canAdvance = () => {
        if (step === 0) return (selectedLead !== null && !existingQuoteId) || isEditing;
        if (step === 1) return scope !== null && scope.rooms.length > 0;
        if (step === 2) return lineItems.length > 0 && lineItems.every(li => li.serviceType && li.clientRate > 0);
        return true;
    };

    // ─── Submit ────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (lineItems.length === 0 || !profile) return;
        setSubmitting(true);
        const totals = computeTotals(lineItems);

        try {
            if (isEditing && existingQuote) {
                const newVersion = (existingQuote.version || 1) + 1;
                const revisionSnapshot = {
                    version: existingQuote.version || 1,
                    totalMonthlyRate: existingQuote.lineItems?.reduce((s, li) => s + (li.clientRate || 0), 0) || 0,
                    lineItems: stripUndefined(existingQuote.lineItems || []),
                    changedBy: profile.uid || profile.email || 'unknown',
                    changedAt: new Date(),
                    notes: notes || '',
                };

                await updateDoc(doc(db, 'quotes', existingQuote.quoteId), {
                    lineItems: stripUndefined(lineItems),
                    totalMonthlyRate: totals.totalMonthly, oneTimeCharges: totals.totalOneTime,
                    subtotalBeforeTax: totals.subtotalBeforeTax, totalTax: totals.totalTax,
                    contractTenure, paymentTerms, exitClause, notes,
                    version: newVersion, status: 'draft', updatedAt: serverTimestamp(),
                });

                const quoteRef = doc(db, 'quotes', existingQuote.quoteId);
                const quoteDoc = await getDoc(quoteRef);
                const existingHistory = quoteDoc.data()?.revisionHistory || [];
                await updateDoc(quoteRef, { revisionHistory: [...existingHistory, revisionSnapshot] });
                await addDoc(collection(db, 'activity_logs'), {
                    type: 'QUOTE_REVISED', quoteId: existingQuote.quoteId,
                    toVersion: newVersion, revisedBy: profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                });

                quoteLogger.quoteSubmitted(existingQuote.quoteId, totals.totalMonthly, true);
                onCreated(existingQuote.quoteId);
            } else {
                if (!selectedLead) return;
                const docRef = await addDoc(collection(db, 'quotes'), {
                    leadId: selectedLead.id, leadBusinessName: selectedLead.businessName,
                    lineItems: stripUndefined(lineItems),
                    totalMonthlyRate: totals.totalMonthly, oneTimeCharges: totals.totalOneTime,
                    subtotalBeforeTax: totals.subtotalBeforeTax, totalTax: totals.totalTax,
                    contractTenure, paymentTerms, exitClause, notes,
                    // Calculator scope snapshot (if available)
                    ...(scope ? {
                        buildingScope: {
                            rooms: scope.rooms,
                            inputs: scope.inputs,
                            results: scope.results,
                        },
                    } : {}),
                    // Proposal T&C (if edited)
                    ...(proposalTerms ? { proposalTerms } : {}),
                    version: 1, revisionHistory: [], status: 'draft',
                    createdBy: profile.uid || profile.email || 'unknown',
                    assignedTo: assignedTo || profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                });

                await addDoc(collection(db, 'activity_logs'), {
                    type: 'QUOTE_CREATED', quoteId: docRef.id, leadId: selectedLead.id,
                    totalRate: totals.totalMonthly, createdBy: profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                });

                quoteLogger.quoteSubmitted(docRef.id, totals.totalMonthly, false);
                onCreated(docRef.id);
            }
        } catch (err) {
            quoteLogger.quoteError('handleSubmit', err);
            alert('Failed to save quote. Check console for details.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold">{isEditing ? 'Revise Quote' : 'New Quote'}</h2>
                        <p className="text-sm text-muted-foreground">
                            Step {step + 1} of {STEPS.length}: {STEPS[step]}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <span className="w-5 h-5">✕</span>
                    </Button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="flex gap-1">
                        {STEPS.map((s, i) => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
                        ))}
                    </div>
                </div>

                {/* Content — delegate to step components */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 0 && (
                        <StepSelectClient
                            leads={leads}
                            selectedLead={selectedLead}
                            onSelectLead={handleSelectLead}
                            existingQuoteId={existingQuoteId}
                            onClose={onClose}
                        />
                    )}
                    {step === 1 && (
                        <StepBuildingScope
                            selectedLead={selectedLead}
                            initialData={initialData}
                            onScopeChange={setScope}
                        />
                    )}
                    {step === 2 && (
                        <StepServicesAndPricing
                            locations={locations}
                            lineItems={lineItems}
                            selectedLead={selectedLead}
                            isEditing={isEditing}
                            existingQuoteVersion={existingQuote?.version}
                            profileUid={profile?.uid || ''}
                            profileRoles={profile?.roles || []}
                            onAddLineItem={addLineItem}
                            onUpdateLineItem={updateLineItem}
                            onRemoveLineItem={removeLineItem}
                        />
                    )}
                    {step === 3 && (
                        <StepTermsAndSubmit
                            selectedLead={selectedLead}
                            locations={locations}
                            lineItems={lineItems}
                            contractTenure={contractTenure}
                            paymentTerms={paymentTerms}
                            exitClause={exitClause}
                            notes={notes}
                            assignedTo={assignedTo}
                            salesUsers={salesUsers}
                            profileUid={profile?.uid || ''}
                            onContractTenureChange={setContractTenure}
                            onPaymentTermsChange={setPaymentTerms}
                            onExitClauseChange={setExitClause}
                            onNotesChange={setNotes}
                            onAssignedToChange={setAssignedTo}
                            proposalTerms={proposalTerms}
                            onProposalTermsChange={setProposalTerms}
                            companyData={companyData}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-muted/10">
                    <Button
                        variant="outline"
                        onClick={() => step > 0 ? handleStepChange(step - 1) : onClose()}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {step > 0 ? 'Back' : 'Cancel'}
                    </Button>

                    {step < STEPS.length - 1 ? (
                        <Button
                            onClick={() => handleStepChange(step + 1)}
                            disabled={!canAdvance()}
                            className="gap-2"
                        >
                            Next
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !canAdvance()}
                            className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                            {submitting ? 'Creating...' : isEditing ? 'Update Quote' : 'Create Quote'}
                            <Check className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
