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
