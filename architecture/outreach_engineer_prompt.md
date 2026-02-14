# Act as the Full Stack Builder Agent ("The Ops Engineer")

**Role:** You are building the "Vendor Onboarding Application".
**Scope:** Although this form lives in `apps/public-site` (User Facing), it is a **Functional App** (Database Writes, File Uploads). Therefore, **YOU (The Ops Builder)** are responsible for its logic and functionality.
**Collaboration:** The Marketing Agent will style it later. You build the engine.

---

## PART 1: The Database (Schema)
**File:** `packages/shared/src/index.ts`
1.  **Update `Vendor` Interface:**
    *   Add `hasActiveContract?: boolean;` (Determines the *Tone* of the message).
    *   Add `onboardingTrack?: 'FAST_TRACK' | 'STANDARD';` (The Vendor's Choice).
    *   Add `campaignId?: string;` (Optional).

## PART 2: The Dashboard (Human-in-the-Loop UI)
**File:** `apps/dashboard/src/components/VendorList.tsx` (and new components)
**Goal:** Give the Human user control over the "Invite" trigger.
1.  **Create `InviteVendorModal.tsx`:**
    *   Triggered when clicking "Approve" or "Invite" on a vendor.
    *   **Question:** "What opportunity are we offering?"
        *   [ ] **Urgent Contract** (Sets `hasActiveContract = true`). "We have a job waiting."
        *   [ ] **Standard Network** (Sets `hasActiveContract = false`). "Join our database."
    *   **Action:** Updates Firestore `vendors/{id}` -> `{ status: 'qualified', hasActiveContract: ... }`.

## PART 3: The Backend (The Trigger)
**File:** `packages/functions/src/agents/outreach.ts` & `triggers/onVendorApproved.ts`
1.  **Fix Trigger Mismatch**: The current trigger listens for `APPROVED`.
    *   **Action**: Change `onVendorApproved.ts` to listen for `newData.status === 'qualified'`.
    *   **Why**: `APPROVED` is not a valid status in our Schema. We use `qualified` for this stage.
2.  **Uncomment Logic**: In `recruiter.ts`, ensure `hasActiveContract` is saved.
3.  **Generate Message**:
    *   **If Urgent:** "Xiri: We have a cleaning contract in [City]. Click to accept: xiri.ai/join/[id]"
    *   **If Standard:** "Xiri: Join our supply network for better pay. Click to register: xiri.ai/join/[id]"

## PART 4: The Public Portal (The Landing Page)
**File:** `apps/public-site/app/onboarding/[vendorId]/page.tsx` (New Route)
**Goal:** The Vendor chooses their speed.
1.  **Hero Section:**
    *   Dynamic Header: "Contract Opportunity" (Red) OR "Partner Network" (Blue) based on `hasActiveContract`.
2.  **The Fork (Choice UI):**
    *   **Option A: Fast Track ("I'm ready to work")**
        *   *Requirement:* **Proof Uploads**.
        *   Render: `<input type="file" />` for COI and W9.
        *   Action: Submits directly to Compliance Review.
    *   **Option B: Standard Track ("Just registering")**
        *   *Requirement:* **Self-Attestation**.
        *   Render: Simple Yes/No Checkboxes ("Do you have Liability Insurance?", "Do you have an LLC?").
        *   Action: Submits to Pending Profile.

## PART 5: Refine Recruitment vs CRM Views
**Goal:** Separate "Incoming Leads" from "Managed Vendors".
1.  **Recruitment Page (`/supply/recruitment`)**:
    *   **Focus:** `pending_review` (Active Work Queue).
    *   **Secondary View:** **"Processed Vendors" (Collapsible/Accordion)**.
        *   **Action:** Group all `qualified`/`rejected` vendors into a section below the main list.
        *   **Default State:** Collapsed (e.g., "15 vendors processed").
        *   **Expanded State:** Shows the grayed-out rows.
        *   **Reason:** Keeps the focus on *new work* while maintaining context.
2.  **CRM Page (`/supply/crm`)**:
    *   **Filter In:** Only `qualified`, `active`, `compliance_review`.
    *   **Filter In:** Only `qualified`, `active`, `compliance_review`.
    *   **Filter Out:** `pending_review` (Keep the noise in Recruitment).

## PART 6: Enhanced Data Table (Town/State/Zip)
**Goal:** Allow granular filtering by location.
1.  **Schema Update**: I have already updated `@xiri/shared` with `city`, `state`, `zip`, `country`.
2.  **UI Update (`VendorList.tsx` & `VendorRow.tsx`)**:
    *   Add columns for **City**, **State**, and **Zip**.
    *   Add a **Filter Bar** (or search input) specifically for State/Zip.
    *   **Reason:** Recruiters need to find vendors in specific territories quickly.
    *   **Note to Builder:** The backend agent is now attempting to parse these fields. For existing vendors, they may be empty. Handle this gracefully (e.g., show "-" or try to parse from `address` string if possible).

## Verification Checklist
1.  [ ] I can click "Approve" in Dashboard and select "Urgent".
2.  [ ] I receive (log) a message with a link.
3.  [ ] The link opens a page with Red "Urgent" branding.
4.  [ ] I can choose "Fast Track" and see File Upload buttons.
