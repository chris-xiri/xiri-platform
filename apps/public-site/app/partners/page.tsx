import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { PartnerBreadcrumb } from '@/components/PartnerBreadcrumb';
import { CAPABILITY_DIRECTORY, getCapabilityGroups } from '@/lib/partner-utils';
import { SITE } from '@/lib/constants';
import { Shield, CheckCircle, Star, Users } from 'lucide-react';
import styles from './partners.module.css';

export const metadata: Metadata = {
  title: 'Vetted Contractor Network | XIRI Partner Directory',
  description:
    'Browse XIRI\'s network of compliance-verified facility management contractors. Every partner carries $1M+ insurance, background checks, and NFC-verified service delivery. Serving the NY metro area.',
  openGraph: {
    title: 'XIRI Partner Directory — Vetted Facility Management Contractors',
    description: 'Find pre-vetted, insured, and compliance-checked commercial contractors for janitorial, HVAC, plumbing, electrical, and 18+ other trades.',
    url: 'https://xiri.ai/partners',
  },
};

const TRUST_STATS = [
  { icon: Shield, label: '$1M+ Liability Insurance', detail: 'Every partner verified' },
  { icon: CheckCircle, label: 'Background Checked', detail: 'All crew members' },
  { icon: Star, label: 'Google-Rated', detail: 'Transparent reviews' },
  { icon: Users, label: 'NFC-Verified', detail: 'Every shift logged' },
];

export default function PartnersPage() {
  const groups = getCapabilityGroups();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    description: 'XIRI\'s vetted contractor network for commercial facility management.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.state,
      postalCode: SITE.address.zip,
    },
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'XIRI Partner Directory — Facility Management Contractor Categories',
    numberOfItems: CAPABILITY_DIRECTORY.length,
    itemListElement: CAPABILITY_DIRECTORY.map((cap, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: cap.label,
      url: `https://xiri.ai/partners/${cap.slug}`,
    })),
  };

  return (
    <>
      <JsonLd data={orgJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <div className={styles.container}>
        <PartnerBreadcrumb crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Partner Directory' },
        ]} />

        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>XIRI&apos;s Vetted Contractor Network</h1>
          <p className={styles.heroDef}>
            XIRI&apos;s partner directory features compliance-verified commercial facility
            management contractors across 22 trade specialties. Every partner carries $1M+
            liability insurance, passes background checks, and delivers NFC-verified
            service for full accountability on every shift.
          </p>
          <p className={styles.heroUpdated}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </section>

        {/* Trust Bar */}
        <section className={styles.trust}>
          {TRUST_STATS.map(stat => (
            <div key={stat.label} className={styles.trustItem}>
              <stat.icon size={24} />
              <div>
                <strong className={styles.trustItemStrong}>{stat.label}</strong>
                <span className={styles.trustItemSpan}>{stat.detail}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Capability Groups */}
        {Object.entries(groups).map(([groupKey, caps]) => (
          <section key={groupKey} className={styles.group}>
            <h2 className={styles.groupTitle}>{caps[0].groupLabel}</h2>
            <div className={styles.grid}>
              {caps.map(cap => (
                <Link key={cap.value} href={`/partners/${cap.slug}`} className={styles.catCard}>
                  <span className={styles.catCardLabel}>{cap.label}</span>
                  <p className={styles.catCardDesc}>
                    {cap.definitionBlock.slice(0, 120)}…
                  </p>
                  <span className={styles.catCardLink}>View contractors →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* Become a Partner CTA */}
        <section className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>Become an XIRI Partner</h2>
          <p className={styles.ctaText}>
            Join our vetted contractor network. Get matched with commercial facility
            management contracts in the NY metro area. No cold calling — we bring the work to you.
          </p>
          <Link href="/onboarding" className={styles.ctaBtn}>
            Apply to Join the Network →
          </Link>
        </section>

        {/* FAQ */}
        <section className={styles.faq}>
          <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            <details className={styles.faqItem}>
              <summary>What does it mean to be an XIRI-vetted contractor?</summary>
              <p>
                Every XIRI partner undergoes compliance verification including $1M+ general
                liability insurance validation, workers&apos; compensation verification,
                background checks for all crew members, and ongoing NFC-based shift
                verification. Contractors who fail to maintain these standards are removed
                from the network.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>How does XIRI verify contractor quality?</summary>
              <p>
                XIRI uses a multi-layer verification process: initial compliance screening
                (insurance, licensing, background checks), Google Places reputation scoring,
                real-time NFC shift logging for every service visit, and ongoing performance
                monitoring. Contractors are scored on a 0-100 compliance scale.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>What happens if a contractor doesn&apos;t meet XIRI standards?</summary>
              <p>
                Contractors who fail compliance requirements are suspended or dismissed from
                the network. Their profile is updated to reflect they no longer meet XIRI
                standards, and alternative vetted contractors are recommended in their place.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary>Can I hire XIRI contractors directly?</summary>
              <p>
                All service requests are routed through XIRI to ensure compliance oversight,
                insurance coverage, and quality accountability. You can request a quote for
                any contractor through our platform, and we handle scheduling, invoicing, and
                quality assurance.
              </p>
            </details>
          </div>
        </section>
      </div>
    </>
  );
}
