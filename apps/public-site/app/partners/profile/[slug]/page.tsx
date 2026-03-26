import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { PartnerBreadcrumb } from '@/components/PartnerBreadcrumb';
import { VendorOffboarded } from '@/components/VendorOffboarded';
import {
  getVendorBySlug,
  getPublishableVendors,
  vendorJsonLd,
  CAPABILITY_MAP,
  PUBLISHABLE_STATUSES,
  OFFBOARDED_STATUSES,
  SERVICE_COUNTY_LABELS,
  type PartnerVendor,
} from '@/lib/partner-utils';
import {
  Star,
  MapPin,
  Shield,
  CheckCircle,
  Award,
  ExternalLink,
} from 'lucide-react';
import {
  CERTIFICATIONS,
  type CertificationOption,
} from '@/lib/partner-utils';
import styles from '../../partners.module.css';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);

  if (!vendor) {
    return { title: 'Contractor Not Found | XIRI Partners' };
  }

  const isPublishable = (PUBLISHABLE_STATUSES as readonly string[]).includes(vendor.status);
  const caps = vendor.capabilities
    .map(c => CAPABILITY_MAP.get(c)?.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  if (!isPublishable) {
    return {
      title: `${vendor.businessName} — No Longer in XIRI Network`,
      description: `${vendor.businessName} no longer meets XIRI's compliance standards. Browse vetted alternatives in our partner directory.`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: `${vendor.businessName} — ${caps} | XIRI Partners`,
    description: `${vendor.businessName} is a compliance-verified ${caps} contractor in ${vendor.city || 'NY'}. $1M+ insured, background-checked, NFC-verified. Request a quote through XIRI.`,
    openGraph: {
      title: `${vendor.businessName} — XIRI-Vetted Contractor`,
      description: `Verified ${caps} contractor serving the NY metro area. Google-rated, insured, and compliance-checked.`,
      url: `https://xiri.ai/partners/profile/${slug}`,
    },
  };
}

// Re-fetch vendor data every hour
export const revalidate = 3600;

export default async function VendorProfilePage({ params }: Props) {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);

  if (!vendor) notFound();

  const isPublishable = (PUBLISHABLE_STATUSES as readonly string[]).includes(vendor.status);
  const isOffboarded = (OFFBOARDED_STATUSES as readonly string[]).includes(vendor.status);

  if (!isPublishable && !isOffboarded) notFound();

  // Offboarded: show degraded page with alternatives
  if (isOffboarded) {
    let alternatives: PartnerVendor[] = [];
    try {
      const all = await getPublishableVendors();
      alternatives = all
        .filter(v => v.id !== vendor.id && v.capabilities.some(c => vendor.capabilities.includes(c)))
        .slice(0, 3);
      if (alternatives.length < 3) {
        const remaining = all.filter(v => v.id !== vendor.id && !alternatives.find(a => a.id === v.id));
        alternatives = [...alternatives, ...remaining].slice(0, 3);
      }
    } catch { /* continue with empty alternatives */ }

    return (
      <div className={styles.profileContainer}>
        <PartnerBreadcrumb crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Partners', href: '/partners' },
          { label: vendor.businessName },
        ]} />
        <VendorOffboarded vendor={vendor} alternatives={alternatives} />
      </div>
    );
  }

  // ─── Active Vendor Profile ────────────────────────────────────
  const capMetas = vendor.capabilities
    .map(c => CAPABILITY_MAP.get(c))
    .filter(Boolean);

  const relevantCerts = CERTIFICATIONS.filter((cert: CertificationOption) =>
    cert.capabilities.length === 0 ||
    cert.capabilities.some((c: string) => vendor.capabilities.includes(c))
  );

  const vendorCerts = vendor.certifications || [];
  const matchedCerts = relevantCerts.filter((cert: CertificationOption) =>
    vendorCerts.includes(cert.value)
  );

  const complianceBadges = [
    vendor.hasGeneralLiability && { label: 'General Liability ($1M+)', icon: Shield },
    vendor.hasWorkersComp && { label: "Workers' Compensation", icon: Shield },
    vendor.hasBackgroundCheck && { label: 'Background Checked', icon: CheckCircle },
  ].filter(Boolean) as { label: string; icon: typeof Shield }[];

  const stars = vendor.googleRating
    ? Array.from({ length: 5 }, (_, i) => i < Math.round(vendor.googleRating!))
    : [];

  return (
    <>
      <JsonLd data={vendorJsonLd(vendor)} />

      <div className={styles.profileContainer}>
        <PartnerBreadcrumb crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Partners', href: '/partners' },
          { label: vendor.businessName },
        ]} />

        {/* Profile Header */}
        <header className={styles.profileHeader}>
          <div className={styles.profileAvatar}>
            {vendor.businessName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className={styles.profileName}>{vendor.businessName}</h1>
            {vendor.city && (
              <p className={styles.profileLocation}>
                <MapPin size={16} />
                {vendor.city}, {vendor.state || 'NY'}
              </p>
            )}
            {vendor.website && (
              <a
                href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.profileWebsite}
              >
                <ExternalLink size={14} />
                {vendor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {vendor.googleRating && vendor.googleRating > 0 && (
              <div className={styles.profileRating}>
                {stars.map((filled, i) => (
                  <Star
                    key={i}
                    size={18}
                    fill={filled ? '#f59e0b' : 'none'}
                    color={filled ? '#f59e0b' : '#d1d5db'}
                  />
                ))}
                <span className={styles.profileRatingText}>
                  {vendor.googleRating.toFixed(1)}
                  {vendor.googleRatingCount && ` (${vendor.googleRatingCount} reviews)`}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Photo Gallery */}
        {vendor.photoUrls && vendor.photoUrls.length > 0 && (
          <section className={styles.photos}>
            <div className={styles.photosGrid}>
              {vendor.photoUrls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${vendor.businessName} — photo ${i + 1}`}
                  className={styles.photosImg}
                  loading="lazy"
                />
              ))}
            </div>
          </section>
        )}

        {/* Website Preview */}
        {vendor.websiteScreenshotUrl && (
          <section className={styles.websiteSection}>
            <h2 className={styles.websiteTitle}>Website Preview</h2>
            <div className={styles.websiteCard}>
              <img
                src={vendor.websiteScreenshotUrl}
                alt={`Screenshot of ${vendor.businessName}'s website`}
                className={styles.websiteImg}
                loading="lazy"
              />
              {vendor.website && (
                <a
                  href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.websiteLink}
                >
                  <ExternalLink size={14} />
                  Visit {vendor.businessName}&apos;s website
                </a>
              )}
            </div>
          </section>
        )}

        <div className={styles.profileBody}>
          {/* Main Content */}
          <div className={styles.profileMain}>
            {vendor.description && (
              <section className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>About {vendor.businessName}</h2>
                <p className={styles.profileSectionText}>{vendor.description}</p>
              </section>
            )}

            <section className={styles.profileSection}>
              <h2 className={styles.profileSectionTitle}>Services &amp; Capabilities</h2>
              <div className={styles.caps}>
                {capMetas.map(cap => (
                  <Link key={cap!.value} href={`/partners/${cap!.slug}`} className={styles.capLink}>
                    {cap!.label}
                  </Link>
                ))}
              </div>
            </section>

            {matchedCerts.length > 0 && (
              <section className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>Verified Certifications</h2>
                <ul className={styles.certsList}>
                  {matchedCerts.map((cert: CertificationOption) => (
                    <li key={cert.value} className={styles.certItem}>
                      <Award size={16} />
                      {cert.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCta}>
              <h3 className={styles.sidebarCtaTitle}>XIRI-Vetted Partner</h3>
              <p className={styles.sidebarCtaText}>
                {vendor.businessName} is a verified member of the XIRI contractor network.
                All partners are screened for insurance, licensing, and performance
                before joining our platform.
              </p>
              <Link href="/#audit" className={styles.sidebarCtaBtn}>
                Get a Free Facility Audit →
              </Link>
              <Link href="/for-contractors" className={styles.sidebarCtaSecondary}>
                Join as a Contractor
              </Link>
            </div>

            {complianceBadges.length > 0 && (
              <div className={styles.compliance}>
                <h3 className={styles.complianceTitle}>Compliance Verified</h3>
                {complianceBadges.map(badge => (
                  <div key={badge.label} className={styles.complianceItem}>
                    <badge.icon size={16} />
                    <span>{badge.label}</span>
                  </div>
                ))}
                <p className={styles.complianceNote}>
                  Verified by XIRI as of {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}

            <div className={styles.networkInfo}>
              <h3 className={styles.networkInfoTitle}>XIRI Network Info</h3>
              <div className={styles.networkInfoItem}>
                <strong className={styles.networkInfoLabel}>Partner since</strong>
                <span className={styles.networkInfoValue}>
                  {vendor.partnerSince
                    ? new Date(vendor.partnerSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : 'XIRI-Vetted'}
                </span>
              </div>
              <div className={styles.networkInfoItem}>
                <strong className={styles.networkInfoLabel}>Service area</strong>
                <div className={styles.serviceAreaTags}>
                  {vendor.serviceCounties && vendor.serviceCounties.length > 0
                    ? vendor.serviceCounties.map(c => (
                        <span key={c} className={styles.serviceAreaTag}>
                          {SERVICE_COUNTY_LABELS[c] || c}
                        </span>
                      ))
                    : <span className={styles.serviceAreaTag}>
                        {vendor.city ? `${vendor.city}, ${vendor.state || 'NY'}` : 'NY Metro Area'}
                      </span>
                  }
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
