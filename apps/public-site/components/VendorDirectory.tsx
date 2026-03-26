'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Star, Shield, MapPin, ChevronRight, CheckCircle, X,
} from 'lucide-react';
import type { PartnerVendor } from '@/lib/partner-utils';
import { CAPABILITY_MAP, SERVICE_COUNTY_LABELS } from '@/lib/partner-utils';
import s from './VendorDirectory.module.css';

/* ── Vendor List Item ── */
function VendorListItem({ vendor }: { vendor: PartnerVendor }) {
  const capLabels = vendor.capabilities
    .map(c => CAPABILITY_MAP.get(c))
    .filter(Boolean)
    .slice(0, 4);

  const stars = vendor.googleRating
    ? Array.from({ length: 5 }, (_, i) => i < Math.round(vendor.googleRating!))
    : [];

  // Display service county labels
  const countyLabels = (vendor.serviceCounties || [])
    .map(c => SERVICE_COUNTY_LABELS[c] || c)
    .slice(0, 3);

  return (
    <Link href={`/partners/profile/${vendor.slug}`} className={s.card}>
      <div className={s.cardLeft}>
        <div className={s.avatar}>
          {vendor.businessName.charAt(0).toUpperCase()}
        </div>
        <div className={s.details}>
          <h3 className={s.name}>{vendor.businessName}</h3>
          {vendor.city && (
            <p className={s.location}>
              <MapPin size={13} />
              {vendor.city}, {vendor.state || 'NY'}
              {vendor.zip && <span className={s.zip}> {vendor.zip}</span>}
            </p>
          )}
          {vendor.googleRating && vendor.googleRating > 0 && (
            <div className={s.rating}>
              <div className={s.stars}>
                {stars.map((filled, i) => (
                  <Star
                    key={i}
                    size={13}
                    fill={filled ? '#f59e0b' : 'none'}
                    color={filled ? '#f59e0b' : '#d1d5db'}
                  />
                ))}
              </div>
              <span className={s.ratingText}>
                {vendor.googleRating.toFixed(1)}
                {vendor.googleRatingCount ? ` (${vendor.googleRatingCount})` : ''}
              </span>
            </div>
          )}
          <div className={s.caps}>
            {capLabels.map(cap => (
              <span key={cap!.value} className={s.capBadge}>
                {cap!.label}
              </span>
            ))}
            {vendor.capabilities.length > 4 && (
              <span className={`${s.capBadge} ${s.capBadgeMuted}`}>
                +{vendor.capabilities.length - 4}
              </span>
            )}
          </div>
          {countyLabels.length > 0 && (
            <div className={s.serviceArea}>
              <span className={s.serviceAreaLabel}>Serves:</span>
              {countyLabels.map(label => (
                <span key={label} className={s.countyTag}>{label}</span>
              ))}
              {(vendor.serviceCounties?.length || 0) > 3 && (
                <span className={`${s.countyTag} ${s.countyTagMuted}`}>
                  +{(vendor.serviceCounties?.length || 0) - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={s.cardRight}>
        <div className={s.compliance}>
          {vendor.hasGeneralLiability && (
            <span className={s.badge}><Shield size={12} /> Insured</span>
          )}
          {vendor.hasWorkersComp && (
            <span className={s.badge}><CheckCircle size={12} /> Workers&apos; Comp</span>
          )}
          {vendor.hasBackgroundCheck && (
            <span className={s.badge}><CheckCircle size={12} /> BG Check</span>
          )}
        </div>
        <span className={s.cta}>
          View Profile <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

/* ── County Filter Chips ── */
function CountyFilter({
  allCounties,
  selected,
  onToggle,
  onClear,
}: {
  allCounties: string[];
  selected: Set<string>;
  onToggle: (county: string) => void;
  onClear: () => void;
}) {
  if (allCounties.length === 0) return null;

  return (
    <div className={s.countyFilter}>
      <span className={s.countyFilterLabel}>Service Area:</span>
      <div className={s.countyChips}>
        {allCounties.map(county => {
          const label = SERVICE_COUNTY_LABELS[county] || county;
          const active = selected.has(county);
          return (
            <button
              key={county}
              type="button"
              onClick={() => onToggle(county)}
              className={`${s.countyChip} ${active ? s.countyChipActive : ''}`}
            >
              {label}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className={s.countyChipClear}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Searchable Directory ── */
interface VendorDirectoryProps {
  vendors: PartnerVendor[];
  capabilityLabel: string;
}

export function VendorDirectory({ vendors, capabilityLabel }: VendorDirectoryProps) {
  const [query, setQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());

  // Collect all unique service counties across vendors
  const allCounties = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach(v => v.serviceCounties?.forEach(c => set.add(c)));
    return Array.from(set).sort((a, b) =>
      (SERVICE_COUNTY_LABELS[a] || a).localeCompare(SERVICE_COUNTY_LABELS[b] || b)
    );
  }, [vendors]);

  const toggleCounty = (county: string) => {
    setSelectedCounties(prev => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = [...vendors];

    // Name / trade search
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        v =>
          v.businessName.toLowerCase().includes(q) ||
          v.capabilities.some(c => {
            const cap = CAPABILITY_MAP.get(c);
            return cap && cap.label.toLowerCase().includes(q);
          })
      );
    }

    // Location / zip search
    if (locationQuery.trim()) {
      const loc = locationQuery.toLowerCase().trim();
      result = result.filter(
        v =>
          (v.zip && v.zip.startsWith(loc)) ||
          (v.city && v.city.toLowerCase().includes(loc)) ||
          (v.state && v.state.toLowerCase().includes(loc)) ||
          (v.serviceCounties?.some(c => {
            const label = SERVICE_COUNTY_LABELS[c] || c;
            return label.toLowerCase().includes(loc);
          }))
      );
    }

    // County chip filter
    if (selectedCounties.size > 0) {
      result = result.filter(
        v => v.serviceCounties?.some(c => selectedCounties.has(c))
      );
    }

    // Sort by rating by default
    result.sort((a, b) => {
      if (a.googleRating && !b.googleRating) return -1;
      if (!a.googleRating && b.googleRating) return 1;
      return (b.googleRating || 0) - (a.googleRating || 0);
    });

    return result;
  }, [vendors, query, locationQuery, selectedCounties]);

  const hasActiveFilters = query.trim() || locationQuery.trim() || selectedCounties.size > 0;

  return (
    <section className={s.vdi}>
      {/* Header */}
      <div className={s.toolbar}>
        <h2 className={s.title}>
          {filtered.length} Vetted {capabilityLabel} Contractor{filtered.length !== 1 ? 's' : ''}
        </h2>
        <div className={s.controls}>
          {/* Name / trade search */}
          <div className={s.searchWrap}>
            <Search size={15} className={s.searchIcon} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by company name…"
              className={s.search}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className={s.searchClear}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Zip code / city search */}
          <div className={s.locationWrap}>
            <MapPin size={15} className={s.searchIcon} />
            <input
              type="text"
              value={locationQuery}
              onChange={e => setLocationQuery(e.target.value)}
              placeholder="Zip code or city"
              className={s.search}
            />
            {locationQuery && (
              <button
                type="button"
                onClick={() => setLocationQuery('')}
                className={s.searchClear}
                aria-label="Clear location"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* County Filter Chips */}
      <CountyFilter
        allCounties={allCounties}
        selected={selectedCounties}
        onToggle={toggleCounty}
        onClear={() => setSelectedCounties(new Set())}
      />

      {/* List */}
      {filtered.length > 0 ? (
        <div className={s.list}>
          {filtered.map(vendor => (
            <VendorListItem key={vendor.id} vendor={vendor} />
          ))}
        </div>
      ) : (
        <div className={s.noResults}>
          <p>No contractors found{hasActiveFilters ? ' matching your search' : ''}</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setQuery(''); setLocationQuery(''); setSelectedCounties(new Set()); }}
              className={s.clearBtn}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
