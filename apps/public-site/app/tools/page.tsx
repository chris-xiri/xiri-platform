import Link from 'next/link';
import { FileCheck2, FlaskConical, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Facility Operations Tools for Owners & Managers | XIRI',
  description: 'Free tools for facility managers and business owners: compliance readiness and chemical/SDS evaluation for janitorial oversight.',
};

export default function ToolsIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold tracking-widest uppercase text-sky-300 mb-3">Free Tools</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Tools for Facility Managers and Owners</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Practical assessment tools to evaluate compliance exposure and product risk before issues become citations, tenant complaints, or budget surprises.
          </p>
          <p className="text-sm text-slate-400 mt-5">
            Contractor or subcontractor? <Link href="/contractors" className="underline hover:text-slate-200">Go to contractor onboarding</Link>.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
          <Link href="/tools/compliance-checker" className="group bg-white rounded-2xl border border-slate-200 p-7 hover:border-sky-300 hover:shadow-md transition-all">
            <FileCheck2 className="w-8 h-8 text-sky-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Compliance Readiness Checker</h2>
            <p className="text-slate-600 mb-4">Score your cleaning program across key regulations and identify highest-risk gaps.</p>
            <span className="inline-flex items-center gap-2 text-sky-700 font-semibold">Open tool <ArrowRight className="w-4 h-4" /></span>
          </Link>

          <Link href="/tools/sds-lookup" className="group bg-white rounded-2xl border border-slate-200 p-7 hover:border-sky-300 hover:shadow-md transition-all">
            <FlaskConical className="w-8 h-8 text-emerald-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">SDS & Chemical Risk Lookup</h2>
            <p className="text-slate-600 mb-4">Review VOC, PPE, and risk notes before approving products in your building program.</p>
            <span className="inline-flex items-center gap-2 text-sky-700 font-semibold">Open tool <ArrowRight className="w-4 h-4" /></span>
          </Link>
        </div>
      </section>
    </div>
  );
}
