# 🎨 Xiri Design System & CRO Spec

**Goal**: Transform the Public Site from "Generic Template" to "Premium Medical Facility Partner".
**Aesthetic**: "Clinical Precision meets Modern Tech." Think Linear.app but for Healthcare.
**Strategy**: High Trust, Low Friction.

## 1. Visual Identity

### Typography
We need a font stack that screams "Clean" and "Legible".
*   **Headings**: `Outfit` (Modern, geometric, approachable).
*   **Body**: `Inter` (The gold standard for readability).
*   **Action**: `JetBrains Mono` (Small caps for technical data like Zip Codes).

### Color Palette (Adaptive Themes)
We use CSS variables mapped to the current Industry Context.

**1. Medical (The "Clinical" Theme)**
*   `--primary`: `sky-600` (Medical Blue)
*   `--accent`: `teal-500` (Surgical Aqua)
*   *Vibe*: Sterile, Trusted, Precise.

**2. Auto (The "Showroom" Theme)**
*   `--primary`: `slate-900` (Asphalt Black)
*   `--accent`: `red-600` (Performance Red)
*   *Vibe*: Sleek, High-Velocity, Glossy.

**3. Daycare (The "Safe Haven" Theme)**
*   `--primary`: `emerald-500` (Safety Green)
*   `--accent`: `amber-400` (Playful Yellow)
*   *Vibe*: Soft, Non-Toxic, Nurturing.

## 2. Conversion Elements (CRO)

### A. The "Hyper-Local" Trust Bar
*   **Location**: Below Navbar, Sticky on Mobile.
*   **Content**: "📍 Serving [Location]: [Zip Code] • [Zip Code]"
*   **Effect**: Immediate validation that "We are in your neighborhood."

### B. The "Industry-First" Hero
*   **Headline**: Dynamic. "Facility Management for **[Industry]** in **[City]**."
*   **Subhead**: "JCAHO Compliant. Insured. Nightly Audited."
*   **Primary CTA**: "Get [City] Rates" (Specific > Generic).

### C. The "Problem/Solution" Cards
Instead of generic stock photos, use **Iconography**.
*   *Problem*: "Inconsistent Vendors?" -> *Solution*: "One Vetted Partner."
*   *Problem*: "Missed Shifts?" -> *Solution*: "GPS-Verified Attendance."

## 3. Component Library (Instructions for Builder)

### `BenefitGrid.tsx`
*   3-Column Grid.
*   Lucide-React Icons (Thin stroke).
*   Hover effect: Slight lift (`-translate-y-1`), shadow increase.

### `ServiceCard.tsx`
*   Border: `1px solid slate-200`.
*   Header: Industry-specific image.
*   Footer: "View [Industry] Services" link.

### `LeadForm.tsx` (The Money Maker)
*   **Multi-Step**: 1. Industry? 2. Square Footage? 3. Contact.
*   **Progress Bar**: Visual indicator of completion.
*   **Micro-Copy**: "No credit card required. Get a quote in 24h."

## 4. Implementation Plan
1.  **Install Fonts**: Add `next/font` for Outfit & Inter.
2.  **Config Tailwind**: Extend the theme with `colors.medical` and `colors.surgical`.
3.  **Refactor Layout**: Apply the "Clinical White" background globally.
4.  **Inject Trust**: Add the Trust Bar to the `RootLayout`.
