import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, CheckCircle2, ShieldAlert, FileText, Calendar, Clock, AlertTriangle, Download, Copy } from 'lucide-react';
import { CTA } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Commercial Janitorial Vendor Transition Toolkit & Switch Guide | XIRI',
    description: 'A step-by-step guide and template kit for facility managers switching commercial cleaning companies with zero service disruption.',
    alternates: {
        canonical: 'https://xiri.ai/tools/janitorial-transition-guide',
    },
};

const TRANSITION_STEPS = [
    {
        phase: 'Phase 1: Contract & SLA Audit (Days 1–15)',
        icon: FileText,
        title: 'Review Existing Contract & Notice Period',
        details: 'Check your current vendor agreement for cancellation clause terms (typically 30-day or 60-day written notice for cause or non-performance). Document all unfulfilled SLA items, missed cleans, or failed quality inspections.'
    },
    {
        phase: 'Phase 2: Walkthrough & New Scope Brief (Days 16–30)',
        icon: Calendar,
        title: 'Conduct Site Walkthrough with XIRI',
        details: 'Walk your facility with a XIRI Facility Solutions Manager. Identify floor care needs, high-touch disinfection zones, supply closet inventory, and physical NFC checkpoint locations.'
    },
    {
        phase: 'Phase 3: Formal Notice & Handover (Days 31–45)',
        icon: AlertTriangle,
        title: 'Issue Formal Written Cancellation Notice',
        details: 'Send certified written notice to your incumbent provider using our downloadable cancellation template. Request return of building keys, access badges, and SDS binders upon shift end.'
    },
    {
        phase: 'Phase 4: Seamless Onboarding (Days 46–60)',
        icon: CheckCircle2,
        title: 'Deploy NFC Tags & Vetted Night Crew',
        details: 'XIRI installs tamper-proof NFC checkpoint tags, stages supplies, conducts crew orientation, and initiates nightly audits with our independent Night Managers. Zero gap in cleaning coverage.'
    }
];

export default function JanitorialTransitionGuidePage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Hero */}
            <section className="bg-slate-900 text-white py-20 relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-6">
                        <ShieldAlert className="w-4 h-4 text-sky-400" />
                        Buyer Transition & Switching Toolkit
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        How to Switch Commercial Cleaning Vendors Without Service Disruption
                    </h1>
                    <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                        Fed up with missed cleans, unverified paper logs, or rising janitorial costs? Use our step-by-step transition roadmap and cancellation notice template to switch seamlessly.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="#cancellation-template"
                            className="inline-flex items-center gap-2 bg-sky-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-sky-500 transition-colors shadow-lg shadow-sky-600/30"
                        >
                            <FileText className="w-5 h-5" />
                            Get Free Cancellation Template
                        </a>
                        <Link
                            href="/audit"
                            className="inline-flex items-center gap-2 bg-white/10 text-white border border-white/20 px-6 py-3.5 rounded-xl font-semibold hover:bg-white/20 transition-colors"
                        >
                            Schedule Site Walkthrough →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Step-by-Step Transition Roadmap */}
            <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">The 60-Day Janitorial Transition Roadmap</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Switching facility providers doesn’t have to disrupt your building operations. Follow these four phases for a seamless transfer.
                    </p>
                </div>

                <div className="space-y-6">
                    {TRANSITION_STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        return (
                            <div key={idx} className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start gap-6">
                                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                                    <StepIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">{step.phase}</span>
                                    <h3 className="text-xl font-bold text-slate-900 mt-1 mb-2">{step.title}</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed">{step.details}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Downloadable / Copyable Cancellation Notice Template */}
            <section id="cancellation-template" className="py-16 bg-slate-100 border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-md">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">Janitorial Vendor Cancellation Notice Template</h3>
                                <p className="text-sm text-slate-500 mt-1">Copy or download this formal termination letter to send to your current vendor.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200">
                                    <FileText className="w-4 h-4" /> Ready to Use
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-900 text-slate-200 rounded-xl p-6 font-mono text-xs leading-relaxed overflow-x-auto select-all">
                            <p className="text-sky-400 mb-4">[DATE]</p>
                            <p className="mb-2">TO: [CURRENT CLEANING COMPANY NAME]</p>
                            <p className="mb-2">ATTN: Account Management / Operations Director</p>
                            <p className="mb-4">RE: Notice of Contract Termination for Janitorial Services at [FACILITY ADDRESS]</p>
                            
                            <p className="mb-4">Dear [ACCOUNT MANAGER NAME],</p>
                            
                            <p className="mb-4">
                                Please accept this letter as formal written notice of termination for the janitorial services agreement dated [CONTRACT DATE] for our facility located at [FACILITY ADDRESS].
                            </p>
                            
                            <p className="mb-4">
                                Pursuant to Section [SECTION NUMBER] of our agreement, this letter serves as our official [30-Day / 60-Day] notice. Final service under your agreement will conclude at 11:59 PM on [LAST SERVICE DATE].
                            </p>
                            
                            <p className="mb-4">
                                Prior to or on [LAST SERVICE DATE], please arrange for the collection of all company-owned equipment and supplies, and return all facility keys, security fobs, access codes, and SDS binders to [NAME / FACILITY MANAGER TITLE].
                            </p>
                            
                            <p className="mb-4">
                                We request a final itemized invoice for services performed through [LAST SERVICE DATE]. Thank you for your past service.
                            </p>
                            
                            <p className="mb-4">Sincerely,</p>
                            <p>[YOUR NAME]</p>
                            <p>[YOUR TITLE]</p>
                            <p>[YOUR COMPANY / FACILITY NAME]</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-20 bg-sky-900 text-white text-center">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-4">Ready for Verified Cleaning with Zero Headaches?</h2>
                    <p className="text-lg text-sky-100 mb-8 max-w-2xl mx-auto">
                        XIRI handles vendor transitions start-to-finish. We walk your building, stage supplies, install NFC verification tags, and deploy vetted night managers with zero service gap.
                    </p>
                    <Link
                        href="/audit"
                        className="inline-flex items-center gap-2 bg-sky-500 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-sky-400 transition-all shadow-xl"
                    >
                        Schedule Your Free Site Audit →
                    </Link>
                </div>
            </section>
        </div>
    );
}
