# @outreach-logic
**Scope:** `packages/functions`, `apps/public-site`
**Role:** Architect

## 1. THE LOGIC FLOW (Corrected)
1.  **Outreach Generation (The Hook):**
    *   **Trigger:** User approves vendor in Dashboard (`hasActiveContract` flag relates to the *internal need*).
    *   **Content (Urgent Mode):** "We have a contract in [Zip]. Complete profile to bid."
    *   **Content (Supply Mode):** "Get paid faster. Join Xiri. Guaranteed returns."
    *   **Link:** All lead to `/onboarding/[vendorId]`.

2.  **Onboarding Portal (The Choice):**
    *   **Landing:** Vendor lands on `/onboarding/[vendorId]`.
    *   **Decision Point:** Vendor chooses their path.
        *   **Path A (Fast Track):** "I'm ready to work." -> **Answers Questions + Uploads Proof (PDF/Image)**.
        *   **Path B (Normal):** "Just registering." -> **Answers Questions Only** (Self-attestation).

## 2. SCHEMA CHANGES (`packages/shared`)
*   `hasActiveContract`: Still needed on `Vendor` to drive the *Message Tone*.
*   `onboardingTrack`: New field `'FAST_TRACK' | 'STANDARD' | null` to track their choice.

## 3. UI ARCHITECTURE (`apps/public-site`)
**Route:** `apps/public-site/app/onboarding/[vendorId]/page.tsx`
*   **Hero Section:** Dynamic Headline based on `hasActiveContract` (passed via URL param or fetched).
*   **The Split:**
    *   **Card 1: "Get Verified Now" (Fast Track)**
        *   "I want to be eligible for jobs immediately."
        *   Action: Unlocks File Uploads.
    *   **Card 2: "Build Profile" (Standard)**
        *   "I want to join the waitlist/network."
        *   Action: specific Yes/No Questions.

## 4. ENGINEER INSTRUCTIONS
*   See `architecture/outreach_engineer_prompt.md`.
