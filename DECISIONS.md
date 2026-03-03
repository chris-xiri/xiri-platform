# 🏛️ Architecture Decisions Log (ADR)
"The Immutable Log of Truth"
Maintained by: @architect-cto

> - Date: 2026-02-13
> - Decision: **Monorepo Architecture (NPM Workspaces)**
> - Rationale: Enforce type safety between "Demand" (Public Site) and "Supply" (Dashboard) using a shared kernel. Avoids code duplication and schema drift.
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **Shared Kernel (@xiri/shared)**
> - Rationale: Single Source of Truth for Domain Types (Lead, Vendor, FacilityType). No application is allowed to define domain types locally.
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **"Medical-First" Strategy**
> - Rationale: Focus on high-compliance verticals (Urgent Care, Surgery Centers) to build trust and authority before expanding to general office/auto.
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **7-Role RBAC System**
> - Rationale: Roles (Admin, Sales Exec, Sales Mgr, Recruiter, FSM, Night Mgr, Accounting) map to specific business workflows, securing data access by persona.
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **Agent Governance Protocol ("The Script")**
> - Rationale: Strict domain boundaries. Dashboard Agent must not modify Public Site. All schema changes must go through the Architect (Shared Package).
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **Tech Stack: Unified Next.js**
> - Rationale: Both `apps/public-site` (Demand) and `apps/dashboard` (Supply) utilize Next.js. *Note: Replaces initial plan of Vite+Refine for Dashboard to utilize existing `xiri-web` codebase.*
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **The "Wedge" Strategy (Janitorial First)**
> - Rationale: Use Recurring Janitorial services to embed into the client operations, then upsell high-margin maintenance ("Roof to Floor").
> - Status: **Active**

> - Date: 2026-02-13
> - Decision: **Industry-First Routing Strategy**
> - Rationale: User navigation should map to their identity (e.g., "I am a Medical Office") -> Recommended Service Bundle. Services like "Commercial Cleaning" are commodities; the *Industry Solution* is the product.
> - Status: **Active**

> - Date: 2026-02-27
> - Decision: **URL-Persisted Tab & Selector State**
> - Rationale: All tabs, selectors, and sub-tabs across the dashboard MUST persist their active state via URL query parameters (e.g., `?channel=facebook_reels&subtab=drafts`). This ensures the user's view survives page refreshes, browser back/forward navigation, and shareable links. On the Social Media page this applies to: the channel selector (`?channel=facebook_posts|facebook_reels`) and the sub-tab (`?subtab=feed|drafts|settings`). Apply the same pattern to any page with tabs or selectors.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Facebook Reels API: Use `video_state: "PUBLISHED"` in Finish Step**
> - Rationale: The Reels API `finish` phase requires `video_state: "PUBLISHED"` (not `published: "true"`) for reels to appear on the page timeline and Reels tab. Without this, reels are accessible via direct link but hidden from the page. Stuck reels can be retroactively fixed via `POST /{video_id}` with `published=true`.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Branded Outro Approach: Static PNG → 3s MP4 via ffmpeg**
> - Rationale: Reel outros are generated as a branded 1080×1920 PNG frame (via `sharp` SVG rendering), converted to a 3-second H.264 MP4 clip with ffmpeg, then concatenated with the source video using ffmpeg `concat` demuxer. Frames are cached in Cloud Storage at `reel-outros/outro_{presetId}.png`. Five presets supported: hiring, quote, coverage, partner, brand.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **`publishPostNow` Memory: 512 MiB**
> - Rationale: ffmpeg video concatenation (outro + reel) exceeded the default 256 MiB limit (341 MiB observed). Bumped to 512 MiB and timeout to 180s.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Reels Feed Sourced from Facebook Graph API (not Firestore)**
> - Rationale: The "feed" tab for FB Reels now calls `getFacebookReels` (which queries `/{page_id}/video_reels`) to show actual published reels on the page, with thumbnails, likes, comments, and "View on Facebook" links. Parallels how the Posts feed calls `getFacebookPosts` to display page posts. Firestore drafts are separate and shown only in the "drafts" tab.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Firestore Rules Must Be Deployed After Local Changes**
> - Rationale: The `social_campaigns` read/write rules were added locally to `firestore.rules` but never deployed, causing "Missing or insufficient permissions" errors. All Firestore rule changes must be deployed via `npx firebase deploy --only firestore:rules`.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Hardcoded XIRI Service Areas (Facebook Place Search Deprecated)**
> - Rationale: Facebook's `/search?type=place` API is fully deprecated for page tokens since Graph API v8.0. The `place_id` parameter is accepted in the Reels finish step but silently ignored (reels don't support place tagging via API — it's UI-only). Location selection now uses a hardcoded dropdown of 13 XIRI service areas (Nassau County, Queens, Long Island) stored in `XIRI_SERVICE_AREAS`. Location names are saved in Firestore for reference and can be included in hashtags.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Drafts Tab: Only Unpublished Items**
> - Rationale: The Firestore query for the Drafts tab filters by `status in ['draft', 'approved', 'rejected', 'failed']`, excluding `published`. Published items are already visible in the Feed tab via the Graph API, so showing them in Drafts was redundant and cluttered the view.
> - Status: **Active**

> - Date: 2026-03-01
> - Decision: **Posts Feed: Filter Out Reels via `permalink_url`**
> - Rationale: Facebook's `/feed` endpoint returns both posts and reels mixed together. The `/posts` endpoint is deprecated. To separate them, `getRecentPosts` fetches from `/feed` and filters out any item whose `permalink_url` contains `/reel/` or `/videos/`. Reels are fetched separately via `getRecentReels` using the dedicated `/video_reels` endpoint.
> - Status: **Active**

> - Date: 2026-03-02
> - Decision: **Structured Address Fields with Google Places Autocomplete**
> - Rationale: All addresses (Leads, Vendors, Locations) must be stored as **four separate fields**: `address` (street line, including suite/unit), `city`, `state` (2-letter abbreviation), and `zip`. A single concatenated address string is never acceptable. On input, use **Google Places Autocomplete** (`react-google-places-autocomplete` + `google.maps.Geocoder`) — selecting a place auto-fills all four fields, which remain individually editable. The `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var is required. For bulk/scraped data, use the ZIP code to look up city and state (via `zippopotam.us` or similar API) rather than regex-parsing concatenated strings.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **SEO Expansion: Programmatic Pages by County**
> - Rationale: Programmatic SEO coverage is expanded county-by-county. To add a new county (e.g., Suffolk, Queens), update these **two files**:
>   1. **`apps/public-site/data/validZips.ts`** — Add all ZIP codes for the county to `ALPHA_ZIPS`. This controls the geofence for the audit wizard lead form (`isValidZip()`). Nassau County has ~110 ZIPs.
>   2. **`apps/public-site/data/seo-data.json`** → `locations[]` — Add location objects with `slug`, `name`, `latitude`, `longitude`, `population`, `medicalDensity`, `keyIntersection`, `localInsight`, `zipCodes`, `landmarks`, `nearbyCities`, `facilityTypes`, `complianceNote`, `serviceChallenges`, `whyXiri`, and `localFaqs`. These power THREE systems: `/services/[slug]-in-{town}` (service × location), `/contractors/[slug]-in-{location}` (trade × location cross-products), and geo pages. The script `scripts/expand-nassau-locations.js` is the reference for bulk generation.
> - Status: **Active (Nassau County complete)**

> - Date: 2026-03-03
> - Decision: **Consolidated `/partners` into `/contractors` (Single Route)**
> - Rationale: The `/partners/[slug]` route (powered by `partnerMarkets.ts`) was a weaker duplicate of the `/contractors/[slug]` route (powered by `dlp-contractors.ts` + `seo-data.json`). The contractors system already generates trade pages, geo pages, keyword/guide pages, AND trade × location cross-product pages — all from the same `seo-data.json` locations array. Keeping both routes fragmented SEO signals and created maintenance overhead. **Deleted**: `/partners`, `/es/partners`, `partnerMarkets.ts`, `lib/seo.ts`. **All location data now lives in one place**: `seo-data.json → locations[]`.
> - Status: **Active**

