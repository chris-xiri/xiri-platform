import { Hero } from '@/components/Hero';
import { CTA } from '@/lib/constants';
import { ValuePropsSection } from '@/components/ValueProps';
import { CTAButton } from '@/components/CTAButton';
import { ClientLeadForm } from '@/components/ClientLeadForm';
import { TrustBar } from '@/components/TrustBar';
import { IndustriesSection } from '@/components/IndustriesSection';
import { Testimonials } from '@/components/Testimonials';
import { HomepageFAQ } from '@/components/HomepageFAQ';
import { MidPageCTA } from '@/components/MidPageCTA';
import { CaseStudySpotlight } from '@/components/CaseStudySpotlight';
import { Rocket, ShieldCheck, ClipboardCheck, Receipt } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Hero
        title={<>Nightly Verified Janitorial &amp;<br /><span className="text-sky-600">Terminal Cleaning for Dental Offices</span></>}
        subtitle="Built for dentist-owners and practice managers. We disinfect your operatories, sterilization areas, and waiting rooms with NFC proof-of-work — so your hygienists treat patients instead of cleaning floors."
        ctaText="Scope My Dental Practice"
        ctaLink="#audit"
        features={[
          { text: 'CDC & OSHA Compliant' },
          { text: 'NFC Proof of Work' },
          { text: '$1M+ Insured' },
        ]}
        secondaryCta={{ text: 'Explore Dental Suite Protocol', href: '/industries/healthcare/dental-offices' }}
      />

      <TrustBar />

      <ValuePropsSection />

      {/* ── Enterprise Credibility & Case Study Spotlight (UBS Arena × Georgia-Pacific) ── */}
      <CaseStudySpotlight />

      {/* ── Mid-Page CTA #1: After Case Study Spotlight ── */}
      <MidPageCTA
        headline="See if we cover your practice area"
        subtext="Enter your zip code — we'll walk your dental office or clinical suite and build a custom janitorial & terminal cleaning scope in 48 hours."
        ctaText={CTA.primary}
        variant="gradient"
        trackingId="after_value_props"
      />

      <Testimonials />

      {/* ── Mid-Page CTA #2: After Testimonials ── */}
      <MidPageCTA
        headline="Join the practices & facilities that trust XIRI"
        subtext="One partner replaces your janitorial crew, handyman, and consumable supply orders. Month-to-month. Cancel anytime."
        ctaText="Get Started — Free Practice Audit"
        variant="dark"
        trackingId="after_testimonials"
        showAskAI
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
                <span className="inline-flex items-center gap-2">
                  <Rocket className="w-4 h-4" />
                  For Practice Owners &amp; Office Managers
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                Get a custom terminal cleaning &amp; janitorial scope for your practice
              </h2>
              <p className="text-xl text-sky-100 mb-8 leading-relaxed">
                We&apos;ll walk your dental office or clinical facility, match you with vetted, clinical-trained teams in your area, and handle everything — from nightly operatory disinfection to restroom supplies and OSHA/CDC compliance logs.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 flex-shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Chair-Safe &amp; 100% Insured</h3>
                    <p className="text-sky-200/80">$1M+ Liability Policy and surface-safe EPA List N disinfectants that protect dental upholstery and equipment.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 flex-shrink-0">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Nightly Verified. Protocol-Driven.</h3>
                    <p className="text-sky-200/80">We verify your vendor followed CDC Dental (DHCP) Infection Control Guidelines and OSHA&apos;s Bloodborne Pathogen Standard (29 CFR 1910.1030) — every night.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-800 flex items-center justify-center text-sky-300 flex-shrink-0">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Relieve Your Office Team</h3>
                    <p className="text-sky-200/80">One consolidated invoice for janitorial, terminal cleaning, supplies, and maintenance — zero vendor chasing for your office manager.</p>
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
