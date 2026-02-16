"use client";

import { useState } from "react";
import { CheckCircle, ArrowRight } from "lucide-react";

interface ContractorValuePropCard {
    id: string;
    outcome: string;
    angle: string;
    headline: string;
    reliefTitle: string;
    relief: string;
    focusTitle: string;
    contractorFocus: string;
    badge: string;
    role: string;
    visual: React.ReactNode;
}

export function ContractorValueProps() {
    const [activeTab, setActiveTab] = useState("jobs");

    // Dynamic Visuals (Mockups)
    const getJobsVisual = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full font-sans text-xs min-h-[250px] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-sky-600"></div>
            <div className="flex justify-between items-center mb-4">
                <div className="font-bold text-gray-900">Available Opportunities</div>
                <div className="text-[10px] text-gray-500">Live Feed • 3 New</div>
            </div>
            <div className="space-y-3">
                {[
                    { title: "Terminal Clean - Urgent Care", loc: "Downtown • 2.5mi", pay: "$$", status: "New" },
                    { title: "Weekly Landscaping", loc: "Westside Auto Mall • 5mi", pay: "$$$", status: "Verified" },
                    { title: "HVAC Maintenance", loc: "Prep School • 1.2mi", pay: "$$$", status: "Urgent" }
                ].map((job, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-sky-200 transition-colors cursor-pointer group">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold text-gray-800">{job.title}</span>
                            <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">{job.status}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>{job.loc}</span>
                            <span className="font-mono text-gray-700 font-bold">{job.pay}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4 text-center">
                <button className="text-sky-600 text-[10px] font-bold hover:underline">View All 12 Local Jobs →</button>
            </div>
        </div>
    );

    const getAdminVisual = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full font-sans text-xs min-h-[250px] relative">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">$</div>
                <div>
                    <div className="font-bold text-gray-900">Payout Scheduled</div>
                    <div className="text-[10px] text-gray-500">Direct Deposit • Net 30</div>
                </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-500">Statement Period</span>
                    <span className="text-gray-900 font-medium">Oct 1 - Oct 31</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">$4,850.00</div>
                <div className="text-[10px] text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Approved for Payout</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] p-2 border-b border-gray-50">
                    <span className="text-gray-600">Client A - Janitorial</span>
                    <span className="font-mono text-gray-900">$1,200</span>
                </div>
                <div className="flex justify-between text-[10px] p-2 border-b border-gray-50">
                    <span className="text-gray-600">Client B - HVAC Repair</span>
                    <span className="font-mono text-gray-900">$850</span>
                </div>
                <div className="flex justify-between text-[10px] p-2">
                    <span className="text-gray-600">Client C - Landscaping</span>
                    <span className="font-mono text-gray-900">$2,800</span>
                </div>
            </div>
        </div>
    );

    const getQualityVisual = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full font-sans text-xs min-h-[250px] relative">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-white/90 z-20 pointer-events-none"></div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-sky-100 flex items-center justify-center text-sky-600 text-[10px] font-bold">QA</div>
                <div className="font-bold text-gray-900">Your FSM Support</div>
            </div>

            <div className="space-y-3 relative z-10">
                <div className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0"></div>
                    <div className="bg-gray-100 rounded-lg rounded-tl-none p-2.5 max-w-[85%]">
                        <p className="text-gray-700 leading-snug">Hey team! Client at Eastside Medical loved the floor work last night. Great job!</p>
                        <span className="text-[9px] text-gray-400 mt-1 block">FSM • 9:02 AM</span>
                    </div>
                </div>
                <div className="flex gap-2.5 flex-row-reverse">
                    <div className="w-6 h-6 rounded-full bg-sky-600 flex-shrink-0"></div>
                    <div className="bg-sky-600 text-white rounded-lg rounded-tr-none p-2.5 max-w-[85%]">
                        <p className="leading-snug">Thanks! We brought in the heavy buffer for the waiting room.</p>
                        <span className="text-[9px] text-sky-200 mt-1 block">You • 9:05 AM</span>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0"></div>
                    <div className="bg-gray-100 rounded-lg rounded-tl-none p-2.5 max-w-[85%]">
                        <p className="text-gray-700 leading-snug">I noticed a light out in the back hallway during my audit - added it to the maintenance queue for you.</p>
                        <span className="text-[9px] text-gray-400 mt-1 block">FSM • 9:10 AM</span>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-full h-8 flex items-center px-3 z-30 shadow-sm">
                <span className="text-gray-400">Message your FSM...</span>
            </div>
        </div>
    );

    const CARDS: ContractorValuePropCard[] = [
        {
            id: "jobs",
            outcome: "Consistent Revenue",
            angle: "No more cold calling.",
            headline: "We Find the Jobs.",
            reliefTitle: "Zero Sales Effort",
            relief: "Stop wasting time bidding on dead-end leads. We act as your sales team, sourcing high-quality commercial clients and assigning you work in your verified service area.",
            focusTitle: "Focus on Execution",
            contractorFocus: "You do the work you're good at. We handle the customer acquisition and contract negotiation.",
            badge: "Verified Opportunities",
            role: "XIRI Sales Engine",
            visual: getJobsVisual()
        },
        {
            id: "admin",
            outcome: "Financial Clarity",
            angle: "Get paid on time.",
            headline: "We Handle the Admin.",
            reliefTitle: "One Monthly Payment",
            relief: "No more chasing 12 different clients for checks. Submit one invoice to XIRI for all your jobs, and get one consolidated direct deposit.",
            focusTitle: "Zero Headaches",
            contractorFocus: "We handle collections, disputes, and billing questions. You just watch the money hit your account.",
            badge: "Guaranteed Payout",
            role: "XIRI Accounting",
            visual: getAdminVisual()
        },
        {
            id: "quality",
            outcome: "Professional Protection",
            angle: "Partner, not vendor.",
            headline: "We Ensure Quality.",
            reliefTitle: "Fair Representation",
            relief: "Clients can be unreasonable. Your FSM acts as a professional buffer, verifying your work objectively and protecting your reputation from unfair complaints.",
            focusTitle: "Nightly Support",
            contractorFocus: "Our Night Auditors verify your work before the client arrives, giving you a chance to fix issues before they become complaints.",
            badge: "Objective Audit",
            role: "Facility Solutions Manager",
            visual: getQualityVisual()
        }
    ];

    const activeCard = CARDS.find(c => c.id === activeTab) || CARDS[0];

    return (
        <section className="py-24 bg-slate-50 relative overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-16 items-start max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* LEFT COLUMN: Content */}
                <div>
                    <div className="mb-10">
                        <h2 className="text-3xl font-heading font-bold text-slate-900 mb-4 tracking-tight">
                            Built for Service Providers
                        </h2>
                        <p className="text-lg text-slate-600">
                            You have the skills. We have the system. Together, we build a scalable business.
                        </p>
                    </div>

                    {/* TABS */}
                    <div className="flex space-x-4 mb-8 border-b border-slate-200 no-scrollbar overflow-x-auto pb-1">
                        {CARDS.map((card, index) => (
                            <button
                                key={card.id}
                                onClick={() => setActiveTab(card.id)}
                                className={`
                                    pb-3 px-2 text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border-b-2
                                    ${activeTab === card.id
                                        ? 'text-sky-700 border-sky-600'
                                        : 'text-slate-400 border-transparent hover:text-slate-600'
                                    }
                                `}
                            >
                                <span className={`text-xs font-mono rounded-full w-5 h-5 flex items-center justify-center ${activeTab === card.id ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                                    0{index + 1}
                                </span>
                                {card.headline}
                            </button>
                        ))}
                    </div>

                    {/* ACTIVE CONTENT */}
                    <div className="animate-fadeIn">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-1 rounded">
                                {activeCard.badge}
                            </span>
                            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                                • {activeCard.role}
                            </span>
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 mb-3">
                            {activeCard.angle}
                        </h3>
                        <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                            {activeCard.relief}
                        </p>

                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4 text-sky-500" />
                                    {activeCard.reliefTitle}
                                </h4>
                                <p className="text-slate-600 text-sm ml-6">
                                    {activeCard.relief}
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4 text-sky-500" />
                                    {activeCard.focusTitle}
                                </h4>
                                <p className="text-slate-600 text-sm ml-6">
                                    {activeCard.contractorFocus}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Visual */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 transform rotate-1 hover:rotate-0 transition-transform duration-500 mt-8 lg:mt-0">
                    <div className="bg-slate-50 rounded-xl overflow-hidden aspect-[4/3] relative flex items-center justify-center p-6">
                        {/* Abstract Background pattern */}
                        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                        <div className="relative w-full max-w-sm">
                            {activeCard.visual}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
