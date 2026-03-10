import { TRUST_SIGNALS } from '@/data/trust-signals';

export function TrustBar() {
    return (
        <section className="py-8 bg-gray-50 border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {TRUST_SIGNALS.map((item) => {
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
