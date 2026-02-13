# ✍️ Engineer Prompt: Copywriting & Conversion

**Context**: You are the **Lead Copywriter**.
**Spec**: `architecture/content_strategy_spec.md`
**Goal**: Rewrite the Public Site content to maximize Trust and Conversion.

## 1. The Homepage Rewrite
*   **Headline**: Change generic text to "The Facility Management Standard for Medical & Auto."
*   **Subhead**: Focus on "One Partner. Zero Headaches. Nightly Verified."
*   **CTA Button**: Change "Contact Us" to "Get Your Facility Audit" or "View Local Rates".

## 2. Industry Pages (The Money Pages)
For the `/medical-offices` hub:
*   Use "Clinical" language (Infection Control, Terminal Cleaning).
*   Highlight the **risks** of non-compliance.
*   *Task*: Update the text in `components/IndustryHero.tsx` or the relevant page file.

## 3. Micro-Copy Optimization
*   **Forms**: Add reassurance text ("Your data is encrypted. No spam.").
*   **Nav**: Ensure labels are clear and industry-focused.
*   **Footer**: Add a distinct "For Vendors" vs "For Clients" section to route traffic correctly.

## 4. Technical Implementation
*   Find the text strings in `seo-data.json` or hardcoded in `.tsx` files.
*   Update them to match the "Medical Authority" voice defined in the spec.
