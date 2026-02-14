# @architect-cto Instruction: Build Vendor Detail Pages

**Role:** Logic & UI Engineer
**Context:** We are building the specific "Detail Views" for the Supply Engine.
**Goal:** Create two distinct experiences for "Qualifying a Lead" vs "Managing a Vendor".

---

## PART 1: Schema Updates
I have already updated `@xiri/shared` with:
*   `Vendor.websiteScreenshotUrl` (for visual qualification).
*   `Vendor.contacts` (array of `VendorContact`).

**Your Job:** Ensure your components use these types.

---

## PART 2: The Recruitment Detail Page (`/supply/recruitment/:id`)
**Goal:** Rapid Qualification. The user needs to verify if this vendor is "Real" and "Capable" in < 30 seconds.

### Layout: Split Screen
*   **Left Column (Quick Actions):**
    *   **Vendor Card**: Business Name, Address (Map Link), Phone.
    *   **AI Interpretation**: Show `aiReasoning`, `fitScore`, and `capabilities`.
    *   **Qualification Form**:
        *   "Does the website look professional?" (Yes/No)
        *   "Do they mention Medical/Commercial?" (Yes/No)
        *   **Action Buttons**: [Standard Qualify] [Urgent Qualify] [Reject].
*   **Right Column (Visual Evidence):**
    *   **The "iframe"**: Embed their `website` URL in a secure iframe.
        *   *Fallback:* If iframe fails (X-Frame-Options), show a "Open in New Tab" button and a placeholder image.
    *   **Google Maps Embed**: Show the street view of their address to verify they have a real office (not a residential house).

### Data Logic
*   **On Load**: Fetch vendor by ID.
*   **On Action**: Update status -> Redirect back to `/supply/recruitment`.

---

## PART 3: The CRM Detail Page (`/supply/crm/:id`)
**Goal:** Account Management. The user needs to manage the long-term relationship.

### Layout: Dashboard Style
*   **Header**: Business Name, Status Badge, "Active Contracts" count.
*   **Tabs Navigation**:

#### Tab 1: Overview
*   **Key Info**: Address, Phone, Email, Primary Contact.
*   **Map**: Visual pin on map.
*   **Quick Notes**: A simple text area to save persistent internal notes.

#### Tab 2: Contacts (New Feature)
*   **List**: Display `Vendor.contacts`.
*   **Add/Edit**: Simple modal to add a Person (Name, Role, Phone, Email).
*   **Roles**: Owner, Dispatch, Billing, Sales.

#### Tab 3: Assignments (Brokerage)
*   **Active Jobs**: List of `Jobs` where `vendorId` == this vendor.
*   **Locations**: List of `ClientLocations` they are assigned to.
*   **Performance**: On-time arrival rate, Average rating.

#### Tab 4: Financials
*   **Payout Methods**: Bank Account / Stripe Connect status.
*   **History**: List of "Bills" (Money owed to them).
*   **Tax Docs**: W9 Status.

#### Tab 5: Compliance & Docs
*   **Status**: Show `compliance` object state (Insurance Exp, W9).
*   **Document List**:
    *   COI (Certificate of Insurance) - [View] [Upload]
    *   W9 - [View] [Upload]
    *   Business License - [View] [Upload]
*   *Note:* Use a simple file input for now. We will hook up storage later.

#### Tab 4: Activity Log
*   **Timeline**: Display `activity_logs` (or `outreach_events`) collection for this `vendorId`.
*   **Events**: Status changes, Notes added, Emails sent.

---

## PART 4: Routing & Permissions
1.  **Routes**: Create the separate pages in Next.js:
    *   `apps/dashboard/src/app/(app)/supply/recruitment/[id]/page.tsx`
    *   `apps/dashboard/src/app/(app)/supply/crm/[id]/page.tsx`
2.  **Breadcrumbs**: Ensure the user can navigate back to the main list easily.

## PART 5: Verification
1.  **Navigation**: Update `VendorRow.tsx` so clicking the Business Name links to:
    *   `/supply/recruitment/:id` (if in Recruitment Mode)
    *   `/supply/crm/:id` (if in CRM Mode)
2.  Clicking a vendor in "Recruitment" goes to the Split Screen view.
3.  Clicking a vendor in "CRM" goes to the Tabbed view.
4.  I can add a "Billing Contact" in the CRM view.
