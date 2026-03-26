'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { PartnerVendor } from '@/lib/partner-utils';
import { VendorCard } from '@/components/VendorCard';

interface VendorOffboardedProps {
  vendor: PartnerVendor;
  alternatives: PartnerVendor[];
}

export function VendorOffboarded({ vendor, alternatives }: VendorOffboardedProps) {
  return (
    <div className="offboarded">
      <div className="offboarded__banner">
        <AlertTriangle size={24} />
        <div>
          <h2>This contractor is no longer in the XIRI network</h2>
          <p>
            <strong>{vendor.businessName}</strong> no longer meets XIRI's compliance
            standards and has been removed from our vetted contractor network.
          </p>
        </div>
      </div>

      {vendor.website && (
        <div className="offboarded__website">
          <p>You can still visit their website directly:</p>
          <a
            href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="offboarded__website-link"
          >
            <ExternalLink size={16} />
            {vendor.website.replace(/^https?:\/\//, '')}
          </a>
          <p className="offboarded__disclaimer">
            Note: Contractors outside the XIRI network are not covered by our compliance
            verification, insurance guarantees, or NFC-verified service delivery.
          </p>
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="offboarded__alternatives">
          <h3>XIRI-Vetted Alternatives</h3>
          <p>These contractors meet our compliance standards and are ready to serve:</p>
          <div className="offboarded__grid">
            {alternatives.slice(0, 3).map(alt => (
              <VendorCard key={alt.id} vendor={alt} />
            ))}
          </div>
        </div>
      )}

      <div className="offboarded__cta">
        <Link href="/partners" className="offboarded__cta-btn">
          Browse All XIRI Partners
        </Link>
        <Link href="/#audit" className="offboarded__cta-link">
          Or get a free site audit →
        </Link>
      </div>

      <style jsx>{`
        .offboarded {
          max-width: 800px;
          margin: 0 auto;
        }
        .offboarded__banner {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 1.5rem;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 12px;
          margin-bottom: 2rem;
        }
        .offboarded__banner h2 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #92400e;
          margin: 0 0 0.5rem;
        }
        .offboarded__banner p {
          font-size: 0.9rem;
          color: #78350f;
          margin: 0;
          line-height: 1.5;
        }
        .offboarded__website {
          padding: 1.5rem;
          background: #f9fafb;
          border-radius: 12px;
          margin-bottom: 2rem;
        }
        .offboarded__website p {
          margin: 0 0 0.75rem;
          font-size: 0.9rem;
          color: #374151;
        }
        .offboarded__website-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          color: #3b82f6;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .offboarded__website-link:hover {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        .offboarded__disclaimer {
          margin-top: 1rem !important;
          font-size: 0.8rem !important;
          color: #9ca3af !important;
          font-style: italic;
        }
        .offboarded__alternatives {
          margin-bottom: 2rem;
        }
        .offboarded__alternatives h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.35rem;
        }
        .offboarded__alternatives p {
          font-size: 0.9rem;
          color: #6b7280;
          margin: 0 0 1rem;
        }
        .offboarded__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1rem;
        }
        .offboarded__cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          background: #eff6ff;
          border-radius: 12px;
          text-align: center;
        }
        .offboarded__cta-btn {
          display: inline-block;
          padding: 0.75rem 2rem;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          transition: background 0.15s ease;
        }
        .offboarded__cta-btn:hover {
          background: #1d4ed8;
        }
        .offboarded__cta-link {
          font-size: 0.85rem;
          color: #3b82f6;
          text-decoration: none;
        }
        .offboarded__cta-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
