'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import type { PartnerVendor } from '@/lib/partner-utils';
import { CAPABILITY_MAP } from '@/lib/partner-utils';

interface VendorCardProps {
  vendor: PartnerVendor;
}

export function VendorCard({ vendor }: VendorCardProps) {
  const capLabels = vendor.capabilities
    .map(c => CAPABILITY_MAP.get(c))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Link
      href={`/partners/profile/${vendor.slug}`}
      className="vendor-card"
    >
      <div className="vendor-card__header">
        <div className="vendor-card__avatar">
          {vendor.businessName.charAt(0).toUpperCase()}
        </div>
        <div className="vendor-card__info">
          <h3 className="vendor-card__name">{vendor.businessName}</h3>
          {vendor.city && (
            <p className="vendor-card__location">
              {vendor.city}, {vendor.state || 'NY'}
            </p>
          )}
        </div>
      </div>

      {vendor.googleRating && vendor.googleRating > 0 && (
        <div className="vendor-card__rating">
          <Star className="vendor-card__star" size={16} fill="currentColor" />
          <span className="vendor-card__rating-value">{vendor.googleRating.toFixed(1)}</span>
          {vendor.googleRatingCount && (
            <span className="vendor-card__rating-count">
              ({vendor.googleRatingCount} reviews)
            </span>
          )}
        </div>
      )}

      <div className="vendor-card__capabilities">
        {capLabels.map(cap => (
          <span key={cap!.value} className="vendor-card__badge">
            {cap!.label}
          </span>
        ))}
        {vendor.capabilities.length > 4 && (
          <span className="vendor-card__badge vendor-card__badge--more">
            +{vendor.capabilities.length - 4} more
          </span>
        )}
      </div>

      <div className="vendor-card__compliance">
        {vendor.hasGeneralLiability && (
          <span className="vendor-card__compliance-badge">✅ Insured</span>
        )}
        {vendor.hasWorkersComp && (
          <span className="vendor-card__compliance-badge">✅ Workers' Comp</span>
        )}
        {vendor.hasBackgroundCheck && (
          <span className="vendor-card__compliance-badge">✅ Background Checked</span>
        )}
      </div>

      <div className="vendor-card__cta">
        View Profile →
      </div>

      <style jsx>{`
        .vendor-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.5rem;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .vendor-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.12);
          transform: translateY(-2px);
        }
        .vendor-card__header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .vendor-card__avatar {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .vendor-card__info {
          min-width: 0;
        }
        .vendor-card__name {
          font-size: 1.05rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vendor-card__location {
          font-size: 0.85rem;
          color: #6b7280;
          margin: 0.15rem 0 0;
        }
        .vendor-card__rating {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .vendor-card__star {
          color: #f59e0b;
        }
        .vendor-card__rating-value {
          font-weight: 600;
          font-size: 0.9rem;
          color: #111827;
        }
        .vendor-card__rating-count {
          font-size: 0.8rem;
          color: #9ca3af;
        }
        .vendor-card__capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .vendor-card__badge {
          display: inline-block;
          padding: 0.2rem 0.55rem;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.72rem;
          font-weight: 500;
          border-radius: 6px;
          white-space: nowrap;
        }
        .vendor-card__badge--more {
          background: #f3f4f6;
          color: #6b7280;
        }
        .vendor-card__compliance {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .vendor-card__compliance-badge {
          font-size: 0.75rem;
          color: #059669;
          font-weight: 500;
        }
        .vendor-card__cta {
          margin-top: auto;
          padding-top: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #3b82f6;
        }
        .vendor-card:hover .vendor-card__cta {
          color: #1d4ed8;
        }
      `}</style>
    </Link>
  );
}
