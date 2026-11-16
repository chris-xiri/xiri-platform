import Link from 'next/link';
import { ShieldCheck, Wifi, CheckCircle2, ArrowRight, Building2, Sparkles, MapPin } from 'lucide-react';

interface CaseStudySpotlightProps {
    /** Optional compact mode for embedding on industry pages */
    variant?: 'full' | 'compact';
}

export function CaseStudySpotlight({ variant = 'full' }: CaseStudySpotlightProps) {
    if (variant === 'compact') {
        return (
            <section className="py-12 bg-slate-900 text-white border-y border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6 md:p-8">
                        <div className="space-y-3 max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-bold uppercase tracking-wider">
                                <Wifi className="w-3.5 h-3.5" />
                                Project Spotlight · Elmont, NY (Nassau County)
                            </div>
                            <h3 className="text-xl md:text-2xl font-heading font-bold text-white">
                                Trusted at UBS Arena for Georgia-Pacific&apos;s IoT Soap Dispensing Hardware Deployment
                            </h3>
                            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                                When Georgia-Pacific needed field execution for connected, smart soap dispensing hardware at UBS Arena, XIRI delivered. We bring that exact same technical precision, hygiene accountability, and supply-chain reliability to private dental practices and clinical suites across Long Island.
                            </p>
                        </div>
                        <div className="flex-shrink-0 w-full lg:w-auto">
                            <a
                                href="#audit"
                                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold px-6 py-3.5 rounded-xl transition-colors text-sm shadow-lg shadow-sky-500/20"
                            >
                                Scope My Practice
                                <ArrowRight className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-20 md:py-24 bg-slate-900 text-white relative overflow-hidden border-y border-slate-800">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Eyebrow & Section Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-bold uppercase tracking-widest mb-4">
                            <Sparkles className="w-3.5 h-3.5" />
                            Enterprise Case Study &amp; Field Spotlight
                        </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-white tracking-tight leading-tight">
                            Enterprise-Grade Execution.<br />
                            <span className="text-sky-400">Built for Dental &amp; Medical Practices.</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-sky-400 flex-shrink-0" />
                        <span>Executed in Elmont, NY · Serving Nassau &amp; Suffolk County</span>
                    </div>
                </div>

                {/* Main Spotlight Card */}
                <div className="grid lg:grid-cols-12 gap-8 items-stretch bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 sm:p-8 lg:p-12 shadow-2xl">
                    {/* Left Column: Narrative & Dental Bridge (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-3 py-1 rounded-lg bg-white/10 text-white font-bold text-xs tracking-wide uppercase">
                                    Venue: UBS Arena
                                </span>
                                <span className="text-slate-500">×</span>
                                <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold text-xs tracking-wide uppercase">
                                    Partner: Georgia-Pacific (GP PRO)
                                </span>
                                <span className="px-3 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30 font-bold text-xs tracking-wide uppercase">
                                    IoT Hygiene Hardware
                                </span>
                            </div>

                            <h3 className="text-2xl sm:text-3xl font-heading font-bold text-white leading-snug">
                                Deploying Georgia-Pacific&apos;s Connected IoT Soap Dispensing Hardware at UBS Arena
                            </h3>

                            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                                XIRI recently completed a field deployment at <strong className="text-white">UBS Arena</strong> in Elmont, NY for <strong className="text-white">Georgia-Pacific&apos;s connected IoT soap dispensing hardware</strong>. Operating inside a premier 18,000+ seat venue requires strict chain-of-custody, technical hardware precision, and zero-defect verification across high-volume restroom zones.
                            </p>

                            {/* The Bridge to Dental Offices */}
                            <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-5 sm:p-6 space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
                                    Why This Matters for Dentists &amp; Practice Managers
                                </p>
                                <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                                    Most local janitorial crews are unmanaged subcontractors with a mop and a key. <strong className="text-white">XIRI is a technology-driven facility operations partner.</strong> Whether we are commissioning smart Georgia-Pacific hygiene hardware at UBS Arena or performing nightly <strong className="text-white">CDC/OSHA terminal cleaning across your dental operatories and sterilization suite</strong>, your practice gets enterprise-grade verification and supply management without the enterprise overhead.
                                </p>
                            </div>
                        </div>

                        {/* Bottom Takeaways + CTA */}
                        <div className="pt-4 border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                    Smart Dispenser &amp; Consumable Logistics
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                    NFC Zone-by-Zone Verification
                                </span>
                            </div>
                            <Link
                                href="/industries/healthcare/dental-offices"
                                className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 font-bold text-sm whitespace-nowrap group"
                            >
                                See Our Dental Office Protocol
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Telemetry / Hardware & Clinical Proof Visual (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 rounded-2xl p-6 border border-slate-700/90 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                                    FIELD DEPLOYMENT LOG
                                </p>
                                <p className="text-base font-bold text-white mt-0.5">
                                    UBS Arena · Elmont, NY
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Verified Complete
                            </span>
                        </div>

                        {/* Spec / Execution Breakdown */}
                        <div className="space-y-4">
                            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Wifi className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Georgia-Pacific IoT Soap Hardware</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Installation, hardware mounting, and smart telemetry readiness for automated restroom hygiene monitoring.
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Applied to Dental &amp; Clinical Suites</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        We bring smart soap/consumable restocking + NFC-verified terminal cleaning directly to dental practice owners &amp; office managers.
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Zero Burden on Your Office Team</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Hygienists and front-desk teams never have to chase empty soap dispensers, paper towels, or missed operatory floors again.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Mini Metric Footer */}
                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800 text-center">
                            <div className="bg-slate-800/40 rounded-lg p-2.5">
                                <p className="text-lg font-bold text-sky-400">$1M+</p>
                                <p className="text-[11px] text-slate-400">Liability Insured</p>
                            </div>
                            <div className="bg-slate-800/40 rounded-lg p-2.5">
                                <p className="text-lg font-bold text-teal-400">100%</p>
                                <p className="text-[11px] text-slate-400">NFC Verified</p>
                            </div>
                            <div className="bg-slate-800/40 rounded-lg p-2.5">
                                <p className="text-lg font-bold text-white">1 Bill</p>
                                <p className="text-[11px] text-slate-400">Clean + Supplies</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
