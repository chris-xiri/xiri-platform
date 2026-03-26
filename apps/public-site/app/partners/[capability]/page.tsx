import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { PartnerBreadcrumb } from '@/components/PartnerBreadcrumb';
import { VendorDirectory } from '@/components/VendorDirectory';
import {
  CAPABILITY_DIRECTORY,
  CAPABILITY_SLUG_MAP,
  getVendorsByCapability,
  capabilityListJsonLd,
  type CapabilityMeta,
  type PartnerVendor,
} from '@/lib/partner-utils';
import styles from '../partners.module.css';

type Props = {
  params: Promise<{ capability: string }>;
};

// Generate all 22 capability pages at build time
export async function generateStaticParams() {
  return CAPABILITY_DIRECTORY.map(cap => ({
    capability: cap.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { capability } = await params;
  const cap = CAPABILITY_SLUG_MAP.get(capability);
  if (!cap) return {};

  return {
    title: cap.seoTitle,
    description: cap.seoDescription,
    openGraph: {
      title: cap.seoTitle,
      description: cap.seoDescription,
      url: `https://xiri.ai/partners/${cap.slug}`,
    },
  };
}

function getCapabilityFaqs(cap: CapabilityMeta) {
  return [
    {
      question: `How do I find a vetted ${cap.label.toLowerCase()} contractor?`,
      answer: `Browse XIRI's ${cap.label.toLowerCase()} partner directory to find compliance-verified contractors in the NY metro area. Every listed contractor carries $1M+ liability insurance and has passed background checks. Click "View Profile" on any contractor to see their full capabilities, certifications, and Google rating.`,
    },
    {
      question: `What certifications should a commercial ${cap.label.toLowerCase()} contractor have?`,
      answer: `Certifications vary by trade. XIRI verifies that all ${cap.label.toLowerCase()} contractors hold required state and local licenses, maintain current insurance, and meet industry-specific standards. Visit any contractor's profile to see their verified certifications.`,
    },
    {
      question: `How does XIRI verify ${cap.label.toLowerCase()} contractors?`,
      answer: `XIRI's verification process includes: $1M+ general liability insurance validation, workers' compensation verification, background checks for all crew members, trade-specific license verification, Google reputation screening, and ongoing NFC-based shift monitoring.`,
    },
  ];
}

// Re-fetch vendor data every hour so new "Ready" vendors appear automatically
export const revalidate = 3600;

export default async function CapabilityPage({ params }: Props) {
  const { capability } = await params;
  const cap = CAPABILITY_SLUG_MAP.get(capability);
  if (!cap) notFound();

  let vendors: PartnerVendor[];
  try {
    vendors = await getVendorsByCapability(cap.value);
  } catch {
    vendors = [];
  }

  vendors.sort((a, b) => {
    if (a.googleRating && !b.googleRating) return -1;
    if (!a.googleRating && b.googleRating) return 1;
    return (b.googleRating || 0) - (a.googleRating || 0);
  });

  const related = CAPABILITY_DIRECTORY.filter(
    c => c.group === cap.group && c.value !== cap.value
  );

  const faqs = getCapabilityFaqs(cap);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <JsonLd data={capabilityListJsonLd(cap, vendors)} />
      <JsonLd data={faqJsonLd} />

      <div className={styles.container}>
        <PartnerBreadcrumb crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Partners', href: '/partners' },
          { label: cap.label },
        ]} />

        {/* Hero */}
        <section className={styles.capHero}>
          <span className={styles.capBadge}>{cap.groupLabel}</span>
          <h1 className={styles.capTitle}>{cap.label} Contractors</h1>
          <p className={styles.capDef}>{cap.definitionBlock}</p>
          <p className={styles.heroUpdated}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </section>

        {/* Vendor List */}
        <section className={styles.vendorsSection}>
          {vendors.length > 0 ? (
            <VendorDirectory vendors={vendors} capabilityLabel={cap.label} />
          ) : (
            <div className={styles.emptyState}>
              <h2 className={styles.emptyTitle}>Contractors Coming Soon</h2>
              <p className={styles.emptyText}>
                We&apos;re actively building our {cap.label.toLowerCase()} contractor network.
                Know a qualified contractor?
              </p>
              <Link href="/onboarding" className={styles.emptyBtn}>
                Refer a Contractor →
              </Link>
            </div>
          )}
        </section>

        {/* FAQ */}
        <section className={styles.faq}>
          <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {faqs.map((faq, i) => (
              <details key={i} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related Capabilities */}
        {related.length > 0 && (
          <section className={styles.relatedSection}>
            <h2 className={styles.relatedTitle}>Related {cap.groupLabel} Services</h2>
            <div className={styles.relatedGrid}>
              {related.map(r => (
                <Link key={r.value} href={`/partners/${r.slug}`} className={styles.relatedLink}>
                  {r.label} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>Need {cap.label}?</h2>
          <p className={styles.ctaText}>Get matched with a vetted contractor — no cold calling, no guesswork.</p>
          <Link href="/#audit" className={styles.ctaBtn}>
            Request a Free Site Audit →
          </Link>
        </section>
      </div>
    </>
  );
}
