import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
    title: 'About XIRI | Our Story & Mission',
    description: 'XIRI brings a tech-first approach to facility management. Founded by a Haverford and INSEAD graduate, we serve Nassau County with nightly-verified cleaning.',
    alternates: {
        canonical: 'https://xiri.ai/about',
    },
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "AboutPage",
                    "mainEntity": {
                        "@type": "Organization",
                        "@id": "https://xiri.ai/#organization"
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://xiri.ai" },
                        { "@type": "ListItem", "position": 2, "name": "About", "item": "https://xiri.ai/about" },
                    ]
                }}
            />

            {/* Hero */}
            <section className="relative pt-32 pb-20 bg-gradient-to-br from-sky-50 to-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-4">About XIRI</p>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight mb-6">
                        Technology meets facility management.
                    </h1>
                    <p className="text-xl text-slate-600 leading-relaxed max-w-2xl">
                        We started XIRI because we believed the facility management industry deserved a fresh perspective — one rooted in operational excellence, genuine commitment to the communities we serve, and selective use of technology.
                    </p>
                </div>
            </section>

            {/* Story */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-12">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">Why We Built XIRI</h2>
                            <div className="text-slate-600 leading-relaxed space-y-4">
                                <p>
                                    Facility management has worked the same way for decades — you hire a cleaning company, a handyman, a supply vendor, maybe a pest control service. You juggle five invoices, chase down no-shows, and hope someone actually followed the compliance protocols overnight.
                                </p>
                                <p>
                                    We come from a background high-level operations, customer satisfaction, and technology. When we looked at how single-tenant buildings were being managed, we saw an industry ripe for the same kind operational rigor that transformed logistics, healthcare, and finance with a dash of technology.
                                </p>
                                <p>
                                    XIRI consolidates all of your facility services under one partner with one invoice, verifies every shift digitally with proof-of-work, and passes the efficiency savings directly to you. No middleman markup. No mystery about whether the work got done.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">What We Believe</h2>
                            <div className="text-slate-600 leading-relaxed space-y-4">
                                <p>
                                    Retail stores, medical offices, and small businesses are the foundation of our community. Every one of those places deserves to be clean, safe, and well-maintained — not just the ones with Fortune 500 budgets.
                                </p>
                                <p>
                                    A clean facility isn&apos;t just about hygiene. It drives sales, improves patient outcomes, retains customers, and builds trust with the community. We believe that operational excellence should be accessible to every building, not just the ones that can afford a full-time facilities director.
                                </p>
                            </div>
                        </div>

                        {/* Founder */}
                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Our Founder</h2>
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="w-24 h-24 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                                    CL
                                </div>
                                <div className="text-slate-600 leading-relaxed space-y-3">
                                    <p className="text-lg font-semibold text-slate-900">Chris Leung</p>
                                    <p>
                                        Chris studied at <strong>Haverford College</strong>, a Quaker institution known for its emphasis on integrity, ethical leadership, and intellectual curiosity — values that shape how XIRI approaches every client relationship.
                                    </p>
                                    <p>
                                        He then earned his MBA at <strong>INSEAD</strong>, ranked the #1 international business school and known globally for entrepreneurship. This combination of principled leadership and global business acumen drives XIRI&apos;s mission to bring world-class operational standards to local facilities.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Local Focus */}
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">Our Community</h2>
                            <div className="text-slate-600 leading-relaxed space-y-4">
                                <p>
                                    XIRI is based in Nassau County, Long Island. We&apos;re part of this community — we shop at the same stores, visit the same doctors, and send our kids to the same schools that we serve.
                                </p>
                                <p>
                                    That&apos;s why we hold ourselves to a higher standard. Every contractor is background-checked, every building carries $1M in liability coverage, and every shift is verified. Because these aren&apos;t just clients — they&apos;re our neighbors.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-16 text-center">
                        <h3 className="text-2xl font-heading font-bold text-slate-900 mb-4">
                            Ready to see what XIRI can do for your building?
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/#audit"
                                className="inline-flex justify-center items-center bg-sky-600 text-white px-8 py-4 rounded-full text-lg font-medium shadow-lg shadow-sky-600/20 hover:bg-sky-700 transition-all"
                            >
                                Get Your Building Scope
                            </Link>
                            <Link
                                href="/calculator"
                                className="inline-flex justify-center items-center px-8 py-4 rounded-full text-lg font-medium text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition-all"
                            >
                                See Pricing →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
