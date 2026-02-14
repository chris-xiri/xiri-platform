# 🏗️ Supply Engine: Stability & Refactor Spec

**Status**: RAPID VETTING
**Component**: `VendorList.tsx` & `CampaignLauncher.tsx`

## 1. Critical Stability Risks (The "Time Bombs")

### A. The "Firehose" Query
*   **Issue**: `VendorList` subscribes to `collection(db, "vendors")` without a `limit()`.
*   **Risk**: As soon as we have > 2,000 vendors, this will crash the browser and spike Firebase reads.
*   **Fix**: Implement Server-Side Pagination or `limit(50)` with infinite scroll.

### B. Client-Side Filtering
*   **Issue**: Search and Status filtering happen in JavaScript (`vendors.filter`).
*   **Risk**: Performance degrades linearly with data size.
*   **Fix**: Move search to a `searchVendors` Cloud Function (using Typesense/Algolia) or Firestore composite indexes.

### C. Campaign Launcher API
*   **Issue**: Uses direct client `httpsCallable`.
*   **Risk**: "CORS" errors often disguise "Cold Start" timeouts or "Region Mismatch" errors.
*   **Fix**: Added explicit `region: 'us-central1'` to the call.

### D. Google Places API (Deprecation Warning)
*   **Issue**: `react-google-autocomplete` uses the Legacy `Autocomplete` class. Google warns this will be deprecated.
*   **Risk**: Future breakage (12+ months out).
*   **Fix**: Migrate to the **New Places API** (Web Component `<gmp-place-autocomplete>`).
    *   *Note*: This requires a specific React wrapper for the Web Component.

### E. Sourcing Strategy (Quality vs Cost)
*   **Discovery**: Stick with **Serper** (`/places`). It is cheap ($1/1000) and finds "Listicles" + GMB.
*   **Verification (Future)**: Use **Google Maps Official API** (Place Details) only for *Qualified* vendors to get:
    *   Real-time Hours
    *   License/Insurance metadata (sometimes in attributes)
    *   High-res Photos for the "Showroom" view.
*   **Action for Builder**: Update `sourcer.ts` to map `rating` and `user_ratings_total` from Serper results into the Vendor schema.

## 2. Refactor Opportunities (Code Quality)

### A. Component Extraction
*   `VendorList` is 350+ lines.
*   **Extract**: `VendorCard` (Mobile), `VendorRow` (Desktop), and `VendorFilters`.

### B. Access Control
*   Currently, the query fetches *all* fields.
*   **Privacy**: Recruiter should see "Contact Info", but maybe not "Payout Rates" (future).
*   **Fix**: Use Refine.dev's access control or strictly typed Firestore Converters.

## 3. Immediate Action Plan (For Builder)
1.  **Add Limits**: Update `VendorList.tsx` to `query(..., limit(100))`.
2.  **Extract Components**: Break down `VendorList` for readability.
