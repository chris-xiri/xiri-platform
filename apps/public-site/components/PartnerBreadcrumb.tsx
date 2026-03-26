import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/partner-utils';

interface Crumb {
  label: string;
  href?: string;
}

interface PartnerBreadcrumbProps {
  crumbs: Crumb[];
}

export function PartnerBreadcrumb({ crumbs }: PartnerBreadcrumbProps) {
  const jsonLdCrumbs = crumbs.map(c => ({
    name: c.label,
    url: c.href ? `https://xiri.ai${c.href}` : 'https://xiri.ai',
  }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(jsonLdCrumbs)} />
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem' }}>
        <ol style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: '0.85rem',
        }}>
          {crumbs.map((crumb, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {i > 0 && <span style={{ color: '#d1d5db' }}>/</span>}
              {crumb.href && i < crumbs.length - 1 ? (
                <Link href={crumb.href} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: '#6b7280' }}>{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
