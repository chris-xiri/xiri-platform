import { Hero } from '@/components/Hero';
import { ValuePropsSection } from '@/components/ValueProps';
import { CTAButton } from '@/components/CTAButton';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { TrustBar } from '@/components/TrustBar';
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Hero
        title={<>The New Standard in<br /><span className="text-sky-600">Facility Management</span></>}
        subtitle="Professional facility management for single-tenant buildings. One Partner. Zero Headaches. Nightly Verified."
        ctaText="Get Your Facility Audit"
        ctaLink="#audit"
      />

      <TrustBar />

      <ValuePropsSection />

      {/* INDUSTRIES ROUTING SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">Specialized for Your Industry</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">We don't do "generic" cleaning. We build custom scopes for your specific compliance needs.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Medical Card */}
            <Link href="/medical-offices" className="group block">
              <div className="relative overflow-hidden rounded-2xl bg-sky-50 p-8 h-full border border-sky-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-sky-900 leading-none -mr-8 -mt-8">Rx</div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🏥</div>
                  <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-sky-600 transition-colors">Medical Facilities</h3>
                  <p className="text-gray-600 mb-6">Urgent Care, Surgery Centers, & Private Practice. Focused on Infection Control & JCAHO Compliance.</p>
                  <span className="text-sky-700 font-bold flex items-center gap-2">View Medical Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                </div>
              </div>
            </Link>

            {/* Automotive Card */}
            <Link href="/auto-dealerships" className="group block">
              <div className="relative overflow-hidden rounded-2xl bg-gray-50 p-8 h-full border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-gray-900 leading-none -mr-8 -mt-8">Au</div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🚘</div>
                  <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">Auto Dealerships</h3>
                  <p className="text-gray-600 mb-6">Showrooms & Service Centers. Focused on High-Gloss Floors & Customer Experience.</p>
                  <span className="text-blue-700 font-bold flex items-center gap-2">View Auto Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                </div>
              </div>
            </Link>

            {/* Commercial/School Card */}
            <Link href="/daycare-preschool" className="group block">
              <div className="relative overflow-hidden rounded-2xl bg-orange-50 p-8 h-full border border-orange-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold text-orange-900 leading-none -mr-8 -mt-8">Ed</div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-4xl mb-6">🧸</div>
                  <h3 className="text-2xl font-bold font-heading text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">Education & Commercial</h3>
                  <p className="text-gray-600 mb-6">Daycares, Schools, & Offices. Focused on Safety, Green Cleaning, & Reliability.</p>
                  <span className="text-orange-700 font-bold flex items-center gap-2">View Education Solutions <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* LEAD FORM SECTION (Anchor: #audit) */}
      <section id="audit" className="py-24 bg-sky-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div className="text-white">
              <div className="inline-block px-4 py-2 rounded-full bg-sky-800 text-sky-200 font-bold text-sm mb-6 border border-sky-700">
                🚀 Start Your Transformation
              </div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                Ready to elevate your facility management?
              </h2>
              <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                Stop worrying about missing shifts, empty supplies, and failed inspections. Let XIRI build a custom scope of work for your facility today.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                    🛡️
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">100% Insured & Vetted</h4>
                    <p className="text-sky-200/80">$1M Liability Policy for every single contractor.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                    🌙
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Nightly Audits</h4>
                    <p className="text-sky-200/80">We physically verify the work every night so you don't have to.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                    💰
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Consolidated Billing</h4>
                    <p className="text-sky-200/80">One invoice for janitorial, supplies, and maintenance.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Lead Form (Generic Mode) */}
            <div className="lg:pl-10">
              <ClientLeadForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
