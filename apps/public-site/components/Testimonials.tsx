import { Star } from 'lucide-react';

const TESTIMONIALS = [
    {
        quote: "We went through three janitorial companies in two years before finding the right fit. Having one partner handle cleaning, supplies, and compliance paperwork has been a game changer — our staff doesn't have to chase vendors anymore.",
        role: "Office Manager",
        facility: "Multi-Specialty Medical Office",
        location: "Nassau County, NY",
        initials: "R.M.",
        rating: 5,
    },
    {
        quote: "The nightly verification reports give us peace of mind we never had before. We know exactly what was cleaned, what was restocked, and whether protocols were followed — without having to check ourselves.",
        role: "Facilities Director",
        facility: "Urgent Care Center",
        location: "Long Island, NY",
        initials: "T.K.",
        rating: 5,
    },
    {
        quote: "Consolidating five separate contractors under one invoice saved us hours every month on billing alone. The cleaning quality is the best we've had in over a decade of managing this building.",
        role: "Property Manager",
        facility: "Professional Office Building",
        location: "Queens, NY",
        initials: "S.P.",
        rating: 5,
    },
];

export function Testimonials() {
    return (
        <section className="py-20 bg-slate-50 border-y border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-3">
                        What Facility Managers Say
                    </p>
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900">
                        Buildings in better shape. Less work for you.
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {TESTIMONIALS.map((t, i) => (
                        <div
                            key={i}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow"
                        >
                            {/* Stars */}
                            <div className="flex gap-0.5 mb-4">
                                {Array.from({ length: t.rating }).map((_, j) => (
                                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                ))}
                            </div>

                            {/* Quote */}
                            <blockquote className="text-slate-600 leading-relaxed mb-6 flex-1">
                                &ldquo;{t.quote}&rdquo;
                            </blockquote>

                            {/* Attribution */}
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {t.initials}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm text-slate-900">{t.role}</p>
                                    <p className="text-xs text-slate-500">{t.facility} · {t.location}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
