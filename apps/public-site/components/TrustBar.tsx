import { Shield, Moon, Heart, UserCheck } from 'lucide-react';

const TRUST_ITEMS = [
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

export function TrustBar() {
    return (
        <section className="py-8 bg-gray-50 border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {TRUST_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-900">{item.label}</p>
                                    <p className="text-xs text-gray-500">{item.detail}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
