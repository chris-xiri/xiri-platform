import { QuoteLineItem, RoomScope, CalculatorInputs } from '@xiri-facility-solutions/shared';

// ─── Props ────────────────────────────────────────────────────────────
export interface QuoteBuilderProps {
    onClose: () => void;
    onCreated: (quoteId: string) => void;
    existingQuote?: {
        quoteId: string;
        leadId: string;
        leadBusinessName: string;
        lineItems: QuoteLineItem[];
        locations?: Location[];
        contractTenure: number;
        paymentTerms: string;
        exitClause: string;
        notes?: string;
        version: number;
    };
    /** Pre-fill data from Calculator, Lead Drawer, or Audit flows */
    initialData?: {
        leadId?: string;
        rate?: number;
        sqft?: number;
        facilityType?: string;
        facilityName?: string;
        rooms?: RoomScope[];
        calculatorInputs?: CalculatorInputs;
    };
}

export interface Location {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
}

// ─── Constants ────────────────────────────────────────────────────────
export const STEPS = ['Select Client', 'Building Scope', 'Review & Pricing', 'Terms & Submit'] as const;

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const SERVICE_COLORS = [
    'border-l-blue-500',
    'border-l-emerald-500',
    'border-l-violet-500',
    'border-l-amber-500',
    'border-l-rose-500',
    'border-l-cyan-500',
    'border-l-orange-500',
    'border-l-pink-500',
] as const;
