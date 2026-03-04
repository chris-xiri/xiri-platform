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

> - Date: 2026-03-03
> - Decision: **Sitemap Trim: ~3,400 → ~1,400 pages (crawl budget)**
> - Rationale: With 64 locations × 19 services × 15 industries × 6 trades × 12 DLPs, the site generates ~3,400+ pages. Many cross-product pages (Industry×Location, DLP×Location, non-janitorial trade×location) are thin — they reuse the same template content with minimal location variation. To protect Google crawl budget, these ~2,000 pages are **excluded from the sitemap** but remain live and accessible. Google only gets ~1,400 high-quality pages: service×location (enriched), service hubs, industry hubs, janitorial×location, contractor DLPs, and guides.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Templates vs Prompts — Two Distinct Patterns**
> - Rationale: The Firestore `templates` collection stores two fundamentally different things that should not be confused:
>   - **Templates** — Static email HTML/text with `{{variable}}` placeholders (e.g. `vendor_outreach_1`, `vendor_outreach_2`). Variables are filled from Firestore data at send time. No AI involved. Used for: vendor outreach sequences, booking confirmations, onboarding invites, and now **referral partnership sequences**.
>   - **Prompts** — Instructions fed to Gemini to generate dynamic content (e.g. `sales_outreach_prompt`, `sales_followup_prompt`). The AI model writes the email body. Used for: sales lead outreach where personalization per facility type matters.
>   - **When to use which**: Use **templates** when the message is standard with known variables (partnership pitches, operational emails). Use **prompts** when each email needs to be meaningfully different based on context (consultative B2B sales by facility type).
>   - Both currently live in the `templates` Firestore collection. Convention: prompts end in `_prompt`, templates are named by sequence (e.g. `vendor_outreach_1`, `referral_partnership_1`).
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Lead Type Classification (`leadType` field)**
> - Rationale: Leads need different outreach sequences based on their type. Added `LeadType` union type to `@xiri/shared`: `'direct'` (standard leads from audit wizard or manual entry), `'tenant'` (Northwell physician affiliate tenants from scraping), `'referral_partnership'` (CRE brokers for referral partnerships). The `leadType` field on `Lead` is optional and defaults to `'direct'`. The `onLeadQualified` trigger reads `leadType` to route to the correct sequence: direct/tenant → Gemini-generated drip (4 emails, Day 0/3/7/14), referral_partnership → static templates (3 emails, Day 0/4/10).
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Enterprise Lead Type — 5-Step Sequence**
> - Rationale: Added `'enterprise'` to the `LeadType` union for large multi-location clients (e.g., Flagstar Bank). Enterprise leads use a 5-step email sequence scheduled over 21 days (Day 0, 4, 8, 14, 21) with the `enterprise_lead_` template prefix. Seed script: `scripts/seed-enterprise-lead-templates.js`. Templates emphasize compliance, multi-site consolidation, and enterprise SLAs. Cloud Functions `onLeadQualified` and `startLeadSequence` both handle the `enterprise` case.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Template Admin: Leads vs Contractors Tabs**
> - Rationale: The template analytics page (`/admin/templates`) was restructured into two tabs: "Lead Templates" (Tenant, Referral, Enterprise pipelines) and "Contractor Templates" (Vendor outreach). This separates concerns and scales cleanly as new lead types are added. Uses `shadcn/ui` `Tabs` component.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **AI Template Optimization: Supervised Only + Notifications**
> - Rationale: The weekly AI optimizer (`aiTemplateOptimizer.ts`) now covers all template categories (`vendor`, `tenant_lead`, `referral_partnership`, `enterprise_lead`). AI optimizations are **suggestions only** — they are stored in `aiSuggestions` on the template doc and require the user to click "Apply" manually. When suggestions are created, a notification is written to the `notifications` Firestore collection. A `NotificationBell` component in the dashboard top bar shows unread counts and links to the template admin page. AI must never auto-apply changes.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **No Warm/Cold Variants for Step 1 Outreach**
> - Rationale: Step 1 (initial outreach) templates should not have warm/cold variants because there are no prior engagement signals at first contact. Warm/cold variants only make sense for follow-up steps (Step 2+) where open/click data exists. Removed Step 1 warm/cold variants from all seed scripts (`seed-lead-templates.js`, `seed-enterprise-lead-templates.js`) and deleted the 6 orphan Firestore documents (`tenant_lead_1_warm/cold`, `referral_partnership_1_warm/cold`, `enterprise_lead_1_warm/cold`). Step 1 templates only have a `standard` variant.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Pipeline Reorder (LinkedIn-style) — localStorage Persisted**
> - Rationale: Lead pipeline sections on the template admin page can be reordered via up/down arrows (triggered by a "Reorder" button). The order is stored as a key array in `localStorage` under `lead-pipeline-order`. The reorder state uses a string key array (`pipelineOrderKeys`) initialized via `useState` lazy initializer to avoid React hooks-rules violations — all hooks must be called before any early returns.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Creatable Facility Type Combobox**
> - Rationale: The Facility Type field in the Add Lead dialog is a searchable, creatable combobox (not a static `Select`). Users can type to filter existing types or add new custom types on the fly. Custom types are slugified and persisted to `localStorage` under `custom-facility-types`. The default list includes all 17 types from the `FacilityType` union in `@xiri/shared`. The component (`FacilityTypeCombobox`) is defined inline in `AddLeadDialog.tsx`.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Address Field: Street Only (No City/State/Country)**
> - Rationale: When a Google Places suggestion is selected in the Add Lead dialog, the address field now displays only the street number + street name (e.g., "9 Lahey Street") extracted from `street_number` and `route` address components. City, state, and ZIP are auto-filled into their own separate fields. Previously the field showed the full Google Places label (e.g., "9 Lahey Street, New Hyde Park, NY, USA") which was redundant. The `address.label` is overwritten with the street-only string after geocoding.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Start Sequence Action in CRM List (Three-Dot Menu)**
> - Rationale: Each lead row in the CRM list (`LeadRow.tsx`) now has a three-dot actions menu (`DropdownMenu`) with "View Details" (navigates to `/sales/crm/[id]`) and "Start Sequence" (calls the `startLeadSequence` Cloud Function directly). If the lead has no email, the Start Sequence option is disabled with a "No email — add to start" message. The `actions` column is included in `DEFAULT_VISIBLE` columns. Previously, starting a sequence required navigating into the lead detail page first.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Firestore Rules: `notifications` and `lead_activities` Collections**
> - Rationale: Added security rules for two new collections. `notifications`: authenticated users can read and update (mark as read), only Cloud Functions can create (via admin SDK). `lead_activities`: authenticated users can read and create, but documents are immutable (no updates or deletes) to maintain an audit trail.
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **⚠️ CAN-SPAM: Unsubscribe Link Required on ALL Outbound Emails (REGULATORY)**
> - Rationale: **Federal regulation — CAN-SPAM Act requires every commercial email to include a visible unsubscribe mechanism.** This applies to ALL outbound emails: vendor outreach, lead outreach (tenant, enterprise, referral), drip sequences, and any new templates/sequences created in the future. Implementation details:
>   1. **Email Footer**: `sendEmail()` in `emailUtils.ts` automatically appends an unsubscribe link + physical address footer when `entityType` is passed. All callers in `outreachWorker.ts` pass `'vendor'` or `'lead'` as `entityType`.
>   2. **List-Unsubscribe Header**: Resend emails include `List-Unsubscribe` and `List-Unsubscribe-Post` headers for one-click unsubscribe in email clients (Gmail, Outlook).
>   3. **Unsubscribe Handler**: `handleUnsubscribe.ts` is a unified HTTP endpoint that handles both vendors (`?type=vendor`) and leads (`?type=lead`). Vendors → status `dismissed`. Leads → status `lost` + `unsubscribedAt` timestamp. All pending outreach tasks are cancelled.
>   4. **Suppression Checks**: `outreachWorker.ts` checks before every send — dismissed vendors and lost/unsubscribed leads are auto-skipped and tasks cancelled.
>   5. **Activity Logging**: Unsubscribe events are logged to `vendor_activities` or `lead_activities` with full metadata.
> - **RULE: Any new email sequence, template, or outbound email feature MUST use `sendEmail()` with the `entityType` parameter to ensure CAN-SPAM compliance. Never bypass the footer.**
> - Status: **Active — Regulatory Requirement**

> - Date: 2026-03-03
> - Decision: **XIRI Brand Name — Always Full Caps**
> - Rationale: The brand name is **XIRI**, never "Xiri" or "xiri". This applies to ALL marketing, sales outreach, branding, email sender names, email footers, photos, social media, templates, and any customer-facing text. Examples: "XIRI Facility Solutions", "XIRI Partnerships", "Chris Leung — XIRI". The only exception is the domain `xiri.ai` which is lowercase by convention.
> - **RULE: Any new email, template, UI text, or branding material MUST use "XIRI" (full caps). Never "Xiri".**
> - Status: **Active — Brand Guideline**

> - Date: 2026-03-03
> - Decision: **Configurable Sender Emails via `email_senders` Collection**
> - Rationale: Email sender names and addresses are stored in the `email_senders` Firestore collection (not hardcoded). Each pipeline (Vendor, Tenant Lead, Referral, Enterprise) can be assigned a different sender from the admin Templates page. The outreach worker reads the sender dynamically at send time via `getSenderFrom()` with in-memory caching. Pipeline-sender mapping is persisted in `config/pipeline_senders`. Current defaults: `partnerships@xiri.ai` for vendor outreach, `chris@xiri.ai` for lead/sales outreach, `onboarding@xiri.ai` for onboarding, `compliance@xiri.ai` for compliance docs. `replyTo` is always `chris@xiri.ai`.
> - **RULE: To add a new sender, create a doc in `email_senders`. To change a pipeline's sender, use the admin Templates page or update `config/pipeline_senders`.**
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Resend Webhook Handles Both Vendors AND Leads**
> - Rationale: `resendWebhook.ts` resolves entity type (vendor or lead) from Resend tags (`vendorId` or `leadId`) with fallback to querying both `vendor_activities` and `lead_activities`. Activities are logged to the correct collection, engagement is updated on the correct entity doc, and template stats are incremented for both. `sendEmail()` tags emails with `leadId` for leads and `vendorId` for vendors.
> - **RULE: Any new email flow must pass `entityType` to `sendEmail()` so the Resend tag correctly identifies the entity for webhook tracking.**
> - Status: **Active**

> - Date: 2026-03-03
> - Decision: **Lead Detail Drawer: 4-Tab Layout**
> - Rationale: The `LeadDetailDrawer.tsx` uses a tabbed layout: **Overview** (Contact, Notes, Quotes, Meta), **Audit** (Audit Booking + Service Interest), **Attribution** (Source/Medium/Campaign/Landing Page), **Activity** (LeadActivityFeed). This separation keeps the drawer organized and prevents information overload.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Janitorial Pricing Calculator — Hours-Based Model at $77/hr**
> - Rationale: Janitorial cleaning is XIRI's main wedge. During audits/walkthroughs, sales needs to give on-the-spot quotes with ±20% accuracy. The calculator uses an **hours-based model** (not $/sqft) because we price per visit — the number of cleaning days is variable per client. The cost stack: **$77/hr** billed to client, **$50/hr** to subcontractor (35% margin for XIRI), **$25/hr** cleaner pay. Per-visit hours are calculated from: `sqft ÷ production rate + fixture time + add-ons × shift multiplier`, with a 1-hour minimum per visit. Monthly rate = `per-visit cost × days/week × 4.33`.
> - **RULE: Pricing is always per-visit first, then multiplied by frequency. Never quote a flat monthly rate without knowing hours/visit.**
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Pricing Config Stored in Firestore (`pricing_config` Collection)**
> - Rationale: The cost stack ($77/hr), production rates, fixture times, floor modifiers, shift multipliers, and add-ons are all stored in `pricing_config/janitorial` in Firestore — not hardcoded. This allows adjusting rates from the admin Settings UI without code deploys. The collection is tagged `janitorial` and designed to be extensible for future service calculators (e.g., floor care, window cleaning). The dashboard component loads config on mount with a hardcoded fallback default if Firestore is unreachable.
> - **RULE: To adjust pricing rates, update the `pricing_config/janitorial` doc in Firestore (or use the Settings UI). Do not hardcode rates in the calculator component.**
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Production Rates (sqft/hr) by Facility Type**
> - Rationale: Different facility types require different cleaning intensity. A cleaner can cover ~4,250 sqft/hr in an office but only ~1,250 sqft/hr in a cleanroom. These rates determine how many hours a visit takes. Current defaults: Office 4,250 | Medical (private/dental/vet) 2,500 | Medical (urgent/surgery/dialysis) 1,750 | Auto 3,500 | Education 3,000 | Gym 3,000 | Retail 4,750 | Lab/Cleanroom 1,250 | Manufacturing 3,000 | Other 3,500. All configurable via `pricing_config/janitorial.productionRates`.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Fixture-Based Time Additions (Restrooms + Trash)**
> - Rationale: Restroom fixtures (toilets, sinks, urinals) and trash bins add predictable time on top of base sqft cleaning. **3 minutes per restroom fixture** and **1 minute per trash bin** are added to each visit. This is more accurate than flat percentage add-ons because fixture count correlates directly with cleaning time. Configured in `pricing_config/janitorial.fixtures`.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Floor Type Breakdown — 4 Industry-Standard Categories**
> - Rationale: Different floor types affect cleaning speed. The calculator lets users specify floor type mix as percentages or sqft with a toggle. Consolidated from 5 ad-hoc types to **4 industry-standard categories**: **Carpet** (1.0x — vacuum, fastest surface), **Resilient** (0.85x — VCT, LVT, vinyl, linoleum, rubber — dust mop + wet mop), **Tile / Stone** (0.75x — ceramic, porcelain, terrazzo, marble — mop + periodic grout care), **Concrete** (1.1x — sealed/polished concrete, epoxy — dust mop, easiest surface). Each floor type has an info tooltip showing cleaning method and included materials. The weighted average adjusts the base production rate. Configured in `pricing_config/janitorial.floorModifiers`.
> - Status: **Active (Updated from 5 types to 4)**

> - Date: 2026-03-04
> - Decision: **Calculator Lives in QuoteBuilder Step 3 as Collapsible Panel**
> - Rationale: The pricing calculator appears below the "Monthly Rate" input in the QuoteBuilder wizard (Step 3: Services & Pricing) **only for janitorial service category items**. It's a collapsible panel — starts collapsed to not overwhelm, one click to expand. The "Use $X/mo" button applies the mid-point estimate to the line item. It auto-fills facility type from the lead and sqft from property sourcing data when available. Non-janitorial services (floor care, window cleaning, etc.) don't show the calculator.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Public SEO Calculators — Standalone Pillar Pages**
> - Rationale: Two public-facing calculators at `xiri.ai/calculator` (clients) and `xiri.ai/contractors/calculator` (contractors). These are **standalone pillar pages** — not linked from other site pages — designed to attract direct traffic from Facebook ads and email campaigns. Each page includes full SEO: JSON-LD schemas (FAQPage + WebApplication), rich FAQ content, average cost tables, and dual CTAs. The nav has a subtle "Calculator" link but no cross-linking from industry/service pages to avoid cluttering those pages.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **State-Variable Pricing (50 States + DC)**
> - Rationale: Pricing varies significantly by state labor market. A **hardcoded state minimum wage table** (`data/state-wages.ts`) maps all 50 states + DC to their current minimum wage. The `scaleRates()` function proportionally scales cleaner, subcontractor, and client rates based on the state's min wage vs New York's $20/hr baseline. Example: Texas ($7.25/hr min) → ~$28/hr client rate vs NY's $77/hr. This is used on the public calculators (statically generated, no Firestore dependency). The internal dashboard calculator continues to use Firestore-stored rates.
> - **RULE: For the public site, use `state-wages.ts`. For the dashboard, use `pricing_config/janitorial` from Firestore.**
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Simple/Advanced Calculator UX (High Engagement Pattern)**
> - Rationale: Public calculators use a **simple/advanced toggle** modeled after NerdWallet and Zillow calculators. **Simple mode** (default): 4 inputs — state, facility type, sqft, frequency. Uses sensible defaults for floor breakdown, fixtures, and shift. **Advanced mode** (expandable): reveals floor type breakdown with tooltips, restroom fixtures, trash bins, shift timing, and add-ons. This maximizes engagement — casual users get an instant answer, power users can refine. A "Refine this estimate →" nudge appears in the results if advanced mode is not open.
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Soft-Gate Lead Capture (No Paywall, Voluntary Email)**
> - Rationale: The public calculators show full estimate ranges **ungated** — no email required to see the result. After the estimate, a **"📧 Email Me a Detailed Breakdown"** CTA opens a modal. Submitting creates a `leads` doc (client calc) or `vendors` doc (contractor calc) in Firestore with calculator data (state, facility type, sqft, estimate). This is a **soft gate** — higher quality leads than a hard gate because they opt in voluntarily. Preserves engagement and SEO dwell time while still capturing leads. GA events track all interactions (view, estimate, advanced toggle, CTA click, email submit) for anonymous traffic research even without email capture.
> - **RULE: Never hard-gate the calculator results. The value is in engagement and SEO dwell time, not forced email collection.**
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Dual Calculator: Client Rate vs Contractor Rate (Margin Protection)**
> - Rationale: The client calculator (`/calculator`) uses the **client rate** ($77/hr in NY) and frames output as "Estimated Monthly Cost." The contractor calculator (`/contractors/calculator`) uses the **sub rate** ($50/hr in NY) and frames output as "Estimated Monthly Earnings." **Neither calculator shows the explicit $/hr rate** — instead showing a "High/Mid/Low-cost market" tier label. This protects XIRI's 35% margin from being visible in a side-by-side comparison. Even if a user visits both pages, they see different monthly totals with different framing — which is natural since cost ≠ earnings. The contractor page uses an emerald/green theme vs sky blue for the client page.
> - **RULE: Never display explicit $/hr rates on public-facing calculators. Use cost-tier labels and monthly totals only.**
> - Status: **Active**

> - Date: 2026-03-04
> - Decision: **Architecture Audit Remediation — Brand, Rate Exposure, Sender Consistency**
> - Rationale: Systematic audit of all ADRs against the codebase revealed 5 inconsistencies, all resolved in this commit:
>   1. **Brand enforcement**: ~50 instances of "Xiri" (mixed case) corrected to "XIRI" across Cloud Functions (`sendOnboardingInvite`, `sendBookingConfirmation`, `onOnboardingComplete`, `processMailQueue`, `onDocumentUploaded`, `sendQuoteEmail`, `onAuditSubmitted`, `onAuditFailed`, `commissionTriggers`), public-site (onboarding translations EN/ES, invoice payment page, onboarding page), and dashboard (vendor layout, toast). Also fixed a "Xini" typo in `sendBookingConfirmation.ts`.
>   2. **Rate exposure**: `calculator/page.tsx` line 206 displayed "$77/hr" explicitly, violating the Dual Calculator margin-protection rule. Replaced with "high-cost market" label.
>   3. **Dynamic activity log**: `onLeadQualified.ts` hardcoded "4 emails over 14 days" regardless of `leadType`. Now dynamically reflects enterprise (5 steps, Day 0/4/8/14/21), referral (3 steps, Day 0/4/10), or direct/tenant (4 steps, Day 0/3/7/14).
>   4. **Hardcoded sender addresses**: `onOnboardingComplete`, `onDocumentUploaded`, `sendQuoteEmail`, `processMailQueue` used inline `from:` strings. Brand name corrected in those addresses; migrating to `getSenderFrom()` is a future improvement.
>   5. **Template prefix naming**: Direct and tenant leads both use `tenant_lead_` template prefix. This is intentional (same 4-step drip), but the naming is ambiguous. Documented here for clarity — no code change needed.
> - Status: **Active**
