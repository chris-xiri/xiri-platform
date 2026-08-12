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
// Memory cache for instantaneous (<10ms) company loading on modal open
let cachedLeads: (Lead & { id: string })[] | null = null;

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

    // Step 1 → Building Scope (calculator-as-scope or unit-based trade scope)
    const [scope, setScope] = useState<{
        mode?: 'janitorial' | 'trades' | 'unit_based';
        serviceType?: string;
        frequency?: string;
        unitItems?: any[];
        rooms?: RoomScope[];
        inputs?: CalculatorInputs;
        results?: CalculatorResults;
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
        let isMounted = true;

        async function fetchLeads() {
            // 1. Immediately populate from cache if available (0ms instant response)
            if (cachedLeads && cachedLeads.length > 0) {
                setLeads(cachedLeads);
                if (existingQuote) {
                    const match = cachedLeads.find(l => l.id === existingQuote.leadId);
                    if (match) setSelectedLead(match);
                } else if (initialData?.leadId) {
                    const match = cachedLeads.find(l => l.id === initialData.leadId);
                    if (match) {
                        handleSelectLead(match);
                        setStep(1);
                    }
                }
            }

            try {
                // 2. Fetch primary company collections first (<200ms ultra-fast initial load)
                const [companiesSnap, crmCompaniesSnap] = await Promise.all([
                    getDocs(collection(db, 'companies')).catch(() => null),
                    getDocs(collection(db, 'crm_company_rows')).catch(() => null),
                ]);

                if (!isMounted) return;

                const companyMap = new Map<string, Lead & { id: string }>();

                if (companiesSnap) {
                    companiesSnap.forEach(d => {
                        const data = d.data();
                        const name = data.businessName || data.name || data.companyName;
                        if (!name) return;
                        companyMap.set(d.id, {
                            id: d.id,
                            businessName: name,
                            facilityType: data.facilityType || 'office_general',
                            contactName: data.contactName || '',
                            contactPhone: data.phone || data.contactPhone || '',
                            email: data.email || '',
                            zipCode: data.zip || data.zipCode || '',
                            address: data.address || '',
                            city: data.city || '',
                            state: data.state || '',
                            zip: data.zip || data.zipCode || '',
                            notes: data.notes || '',
                            status: data.status || 'new',
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            attribution: data.attribution || { source: 'manual', medium: 'manual', campaign: '', landingPage: '' },
                        } as Lead & { id: string });
                    });
                }

                if (crmCompaniesSnap) {
                    crmCompaniesSnap.forEach(d => {
                        const data = d.data();
                        const cid = data.companyId || d.id;
                        if (companyMap.has(cid)) return;
                        const name = data.businessName || data.name || data.companyName;
                        if (!name) return;
                        companyMap.set(cid, {
                            id: cid,
                            businessName: name,
                            facilityType: data.facilityType || 'office_general',
                            contactName: data.contactName || '',
                            contactPhone: data.phone || data.contactPhone || '',
                            email: data.email || '',
                            zipCode: data.zip || data.zipCode || '',
                            address: data.address || '',
                            city: data.city || '',
                            state: data.state || '',
                            zip: data.zip || data.zipCode || '',
                            notes: data.notes || '',
                            status: data.status || 'new',
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            attribution: data.attribution || { source: 'manual', medium: 'manual', campaign: '', landingPage: '' },
                        } as Lead & { id: string });
                    });
                }

                const initialList = Array.from(companyMap.values()).sort((a, b) =>
                    (a.businessName || '').localeCompare(b.businessName || '')
                );

                if (initialList.length > 0) {
                    cachedLeads = initialList;
                    setLeads(initialList);
                    if (existingQuote) {
                        const match = initialList.find(l => l.id === existingQuote.leadId);
                        if (match) setSelectedLead(match);
                    } else if (initialData?.leadId) {
                        const match = initialList.find(l => l.id === initialData.leadId);
                        if (match) {
                            handleSelectLead(match);
                            setStep(1);
                        }
                    }
                }

                // 3. Background enrichment: fetch contacts, crm_contact_rows, and legacy leads without blocking UI
                const [leadsSnap, contactsSnap, crmContactsSnap] = await Promise.all([
                    getDocs(collection(db, 'leads')).catch(() => null),
                    getDocs(collection(db, 'contacts')).catch(() => null),
                    getDocs(collection(db, 'crm_contact_rows')).catch(() => null),
                ]);

                if (!isMounted) return;

                const contactsByCompany = new Map<string, { contactName: string; contactPhone: string; email: string }>();
                [...(contactsSnap?.docs || []), ...(crmContactsSnap?.docs || [])].forEach(d => {
                    const c = d.data();
                    const companyId = c.companyId;
                    if (!companyId) return;
                    const name = [c.firstName || c.contactName, c.lastName].filter(Boolean).join(' ') || c.contactName || c.name || '';
                    const existing = contactsByCompany.get(companyId);
                    if (!existing || c.isPrimary) {
                        contactsByCompany.set(companyId, {
                            contactName: name,
                            contactPhone: c.phone || c.contactPhone || '',
                            email: c.email || '',
                        });
                    }
                });

                // Update contact details on existing companies
                companyMap.forEach((comp, id) => {
                    const contact = contactsByCompany.get(id);
                    if (contact) {
                        if (!comp.contactName) comp.contactName = contact.contactName;
                        if (!comp.contactPhone) comp.contactPhone = contact.contactPhone;
                        if (!comp.email) comp.email = contact.email;
                    }
                });

                // Add legacy leads
                if (leadsSnap) {
                    leadsSnap.forEach(d => {
                        if (companyMap.has(d.id)) return;
                        const data = d.data();
                        const name = data.businessName || data.name || data.companyName;
                        if (!name) return;
                        companyMap.set(d.id, {
                            id: d.id,
                            businessName: name,
                            facilityType: data.facilityType || 'office_general',
                            contactName: data.contactName || '',
                            contactPhone: data.contactPhone || data.phone || '',
                            email: data.email || '',
                            zipCode: data.zipCode || data.zip || '',
                            address: data.address || '',
                            city: data.city || '',
                            state: data.state || '',
                            zip: data.zip || data.zipCode || '',
                            notes: data.notes || '',
                            status: data.status || 'new',
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            attribution: data.attribution || { source: 'manual', medium: 'manual', campaign: '', landingPage: '' },
                            locations: data.locations,
                        } as Lead & { id: string });
                    });
                }

                // Add orphan contacts as companies
                [...(contactsSnap?.docs || []), ...(crmContactsSnap?.docs || [])].forEach(d => {
                    const data = d.data();
                    const cid = data.companyId || d.id;
                    if (companyMap.has(cid)) return;
                    const name = data.companyName || data.businessName;
                    if (!name) return;
                    companyMap.set(cid, {
                        id: cid,
                        businessName: name,
                        facilityType: data.facilityType || 'office_general',
                        contactName: [data.firstName, data.lastName].filter(Boolean).join(' ') || data.contactName || '',
                        contactPhone: data.phone || data.contactPhone || '',
                        email: data.email || '',
                        zipCode: data.zip || data.zipCode || '',
                        address: data.address || '',
                        city: data.city || '',
                        state: data.state || '',
                        zip: data.zip || data.zipCode || '',
                        status: 'new',
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                        attribution: { source: 'manual', medium: 'manual', campaign: '', landingPage: '' },
                    } as Lead & { id: string });
                });

                const finalList = Array.from(companyMap.values()).sort((a, b) =>
                    (a.businessName || '').localeCompare(b.businessName || '')
                );
                cachedLeads = finalList;
                setLeads(finalList);

                if (existingQuote) {
                    const match = finalList.find(l => l.id === existingQuote.leadId);
                    if (match) setSelectedLead(match);
                } else if (initialData?.leadId) {
                    const match = finalList.find(l => l.id === initialData.leadId);
                    if (match) {
                        handleSelectLead(match);
                        setStep(1);
                    }
                }
            } catch (err) {
                quoteLogger.quoteError('fetchLeads', err);
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

        // Auto-generate line items when advancing from Scope → Review
        if (step === 1 && newStep === 2 && scope) {
            setLocations([scope.location]);
            const userId = profile?.uid || profile?.email || 'unknown';
            const isFsm = profile?.roles?.some((r: string) => r === 'fsm');

            if (scope.mode === 'trades' || scope.mode === 'unit_based' || (scope.unitItems && scope.unitItems.length > 0)) {
                const unitItems = scope.unitItems || [];
                const totalRate = unitItems.reduce((s: number, u: any) => s + (u.subtotal || 0), 0);
                const scopeTasks = unitItems.map((u: any) => ({
                    name: `${u.description} (${u.quantity} ${u.unit} @ $${u.unitPrice}/${u.unit})`,
                    description: `$${(u.subtotal || 0).toFixed(2)} subtotal`,
                    required: true,
                    isCustom: true,
                }));

                setLineItems(prev => {
                    const existingTrade = prev.find(li => li.serviceCategory === 'trades' || (li.unitItems && li.unitItems.length > 0));
                    const itemId = existingTrade?.id || `li_trade_${Date.now()}`;
                    const taxRate = existingTrade?.taxRate ?? 0.08625;

                    const tradeItem: QuoteLineItem = {
                        id: itemId,
                        locationId: scope.location.id,
                        locationName: scope.location.name,
                        locationAddress: scope.location.address,
                        locationCity: scope.location.city,
                        locationState: scope.location.state,
                        locationZip: scope.location.zip,
                        serviceType: scope.serviceType || existingTrade?.serviceType || 'Light Carpentry & Woodwork',
                        serviceCategory: 'trades',
                        frequency: (scope.frequency as any) || existingTrade?.frequency || 'one_time',
                        clientRate: totalRate,
                        taxRate,
                        taxAmount: Math.round(totalRate * taxRate * 100) / 100,
                        unitItems: unitItems,
                        scopeTasks,
                        lineItemStatus: 'pending' as const,
                        addedBy: userId,
                        addedByRole: (isFsm ? 'fsm' : 'sales') as 'sales' | 'fsm',
                        isUpsell: false,
                    };

                    const nonTrade = prev.filter(li => li.id !== itemId && !li.unitItems && li.serviceCategory !== 'trades');
                    return [tradeItem, ...nonTrade];
                });

                setContractTenure(prev => (prev === undefined || prev === 12) ? 0 : prev);
                setPaymentTerms(prev => (prev === 'Pay on the 25th' || !prev) ? 'Due Upon Completion & Sign-off' : prev);
            } else if (scope.rooms && scope.rooms.length > 0 && scope.results && scope.inputs) {
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
                const seen = new Set<string>();
                const uniqueTasks = scopeTasks.filter(t => {
                    if (seen.has(t.name)) return false;
                    seen.add(t.name);
                    return true;
                });

                const NASSAU_TAX_RATE = 0.08625; // 8.625% Nassau County Tax
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
                    taxRate: NASSAU_TAX_RATE,
                    taxAmount: Math.round(scope.results.totalPricePerMonth * NASSAU_TAX_RATE * 100) / 100,
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

                setLineItems(prev => {
                    const nonJan = prev.filter(li => li.serviceType !== 'Janitorial' || !li.rooms);
                    return [janItem, ...nonJan];
                });
            }
        }

        setStep(newStep);
    };

    const canAdvance = () => {
        if (step === 0) return (selectedLead !== null && !existingQuoteId) || isEditing;
        if (step === 1) return true; // Optional for non-janitorial / trades / custom quotes
        if (step === 2) return lineItems.length > 0 && lineItems.every(li => !!li.serviceType && (li.clientRate >= 0 || (li.unitItems && li.unitItems.length > 0)));
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
                    contractTenure: existingQuote.contractTenure,
                    paymentTerms: existingQuote.paymentTerms,
                    exitClause: existingQuote.exitClause,
                    notes: existingQuote.notes,
                    updatedAt: new Date(),
                };

                await updateDoc(doc(db, 'quotes', existingQuote.quoteId), {
                    lineItems: stripUndefined(lineItems),
                    totalMonthlyRate: totals.totalMonthly,
                    oneTimeCharges: totals.totalOneTime,
                    subtotalBeforeTax: totals.subtotalBeforeTax,
                    totalTax: totals.totalTax,
                    contractTenure,
                    paymentTerms,
                    exitClause,
                    notes,
                    assignedTo: assignedTo || profile.uid || 'unassigned',
                    version: newVersion,
                    updatedAt: serverTimestamp(),
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
                    version: 1, status: 'draft',
                    assignedTo: assignedTo || profile.uid || 'unassigned',
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                });

                await addDoc(collection(db, 'activity_logs'), {
                    type: 'QUOTE_CREATED', quoteId: docRef.id,
                    leadId: selectedLead.id, businessName: selectedLead.businessName,
                    totalMonthlyRate: totals.totalMonthly,
                    createdBy: profile.uid || profile.email || 'unknown',
                    createdAt: serverTimestamp(),
                });

                quoteLogger.quoteSubmitted(docRef.id, totals.totalMonthly, false);
                onCreated(docRef.id);
            }
        } catch (err) {
            console.error('Failed to save quote:', err);
            alert('Failed to save quote. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {isEditing ? `Edit Quote v${(existingQuote?.version || 1) + 1}` : 'Create New Quote'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Step {step + 1} of {STEPS.length} — {STEPS[step]}
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
                            existingScope={scope}
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
