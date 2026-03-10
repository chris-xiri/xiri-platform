// ─── Trust Signals ───────────────────────────────────────────────
// Used by: TrustBar, Hero feature list, homepage, IndustryHubPage
import { Shield, Moon, Heart, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TrustSignal {
    icon: LucideIcon;
    label: string;
    detail: string;
    color: string;
    bg: string;
}

export const TRUST_SIGNALS: TrustSignal[] = [
    {
        icon: Shield,
        label: '100% Insured',
        detail: '$1M liability verified',
        color: 'text-sky-600',
        bg: 'bg-sky-50',
    },
    {
        icon: Moon,
        label: 'Nightly Audits',
        detail: 'Physically verified',
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
    },
    {
        icon: Heart,
        label: 'HIPAA-Aware',
        detail: 'Medical-grade protocols',
        color: 'text-rose-600',
        bg: 'bg-rose-50',
    },
    {
        icon: UserCheck,
        label: 'Background Checked',
        detail: 'Every contractor vetted',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
    },
];
