import { Hero } from '@/components/Hero';
import { ValuePropsSection } from '@/components/ValueProps';
import { CTAButton } from '@/components/CTAButton';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { TrustBar } from '@/components/TrustBar';
import { IndustriesSection } from '@/components/IndustriesSection';
import { Testimonials } from '@/components/Testimonials';
import { HomepageFAQ } from '@/components/HomepageFAQ';
import { MidPageCTA } from '@/components/MidPageCTA';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Hero
        title={<>Was Your Building Actually<br /><span className="text-sky-600">Cleaned Last Night?</span></>}
        subtitle="XIRI gives you verified proof of what was cleaned, when, and by whom. One partner for cleaning, maintenance, supplies, and compliance."
        ctaText="Get Verified Cleaning"
        ctaLink="#audit"
        features={[
          { text: 'Proof of Work' },
          { text: '100% Insured' },
          { text: 'Compliance Ready' },
        ]}
        secondaryCta={{ text: 'See How Verification Works →', href: '/solutions/cleaning-verification' }}
      />

      <TrustBar />

      <ValuePropsSection />

      {/* ── Mid-Page CTA #1: After Value Props ── */}
      <MidPageCTA
        headline="See if we cover your area"
        subtext="Enter your zip code — we'll tell you if we can service your building and build a custom scope in 48 hours."
        ctaText="Get Your Building Scope"
        variant="gradient"
        trackingId="after_value_props"
      />

      <Testimonials />

      {/* ── Mid-Page CTA #2: After Testimonials ── */}
      <MidPageCTA
        headline="Join the facilities that trust XIRI"
        subtext="One partner replaces your cleaning company, handyman, and supply orders. No contracts. Cancel anytime."
        ctaText="Get Started — Free Audit"
        variant="dark"
        trackingId="after_testimonials"
      />

      <IndustriesSection />

      {/* LEAD FORM SECTION (Anchor: #audit) — Moved ABOVE FAQ */}
      <section id="audit" className="py-24 bg-sky-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div className="text-white">
              <div className="inline-block px-4 py-2 rounded-full bg-sky-800 text-sky-200 font-bold text-sm mb-6 border border-sky-700">
                🚀 One Partner. One Invoice. Done.
              </div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                Get a custom cleaning scope for your building
              </h2>
              <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                We&apos;ll walk your facility, match you with vetted contractors already in your area, and handle everything — from nightly cleaning to supplies to compliance paperwork.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                    🛡️
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">100% Insured &amp; Vetted</h4>
                    <p className="text-sky-200/80">$1M Liability Policy for every single contractor.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 text-2xl flex-shrink-0">
                    🌙
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Nightly Verified. Protocol-Driven.</h4>
                    <p className="text-sky-200/80">We verify your vendor followed CDC Guidelines for Healthcare Facilities and OSHA&apos;s Bloodborne Pathogen Standard (29 CFR 1910.1030) — every night.</p>
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

      <HomepageFAQ />
    </div>
  );
}
