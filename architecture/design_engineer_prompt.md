# 🎨 Engineer Prompt: Design System Implementation

**Context**: We are elevating the `apps/public-site` to a "Premium Medical" aesthetic.
**Spec**: `architecture/design_system_spec.md`
**Goal**: Implement the Visual Identity and CRO improvements.

## 1. Foundation: Theme Setup
*   **Install Fonts**: Use `next/font/google` to add `Outfit` (Headings) and `Inter` (Body).
*   **Tailwind Config**:
    *   Add custom colors: `medical` (sky-600), `surgical` (teal-500).
    *   Set `fontFamily` based on new fonts.
    *   *Note*: If using Tailwind v4, update CSS variables in `globals.css` accordingly.

## 2. Refactor Components
*   **Navigation**: Add the "Trust Bar" below the main nav. It must be sticky.
*   **Hero Section**: Update to use the "Split Screen" layout (Text Left, Image Right) with the new typography.
*   **Cards**: Update `ServiceCard` and `BenefitGrid` to use the new "Clinical White" style (subtle borders, clean shadows).

## 3. The Lead Form (Critical)
*   If `LeadForm.tsx` exists, style it to look like a "Medical Intake Form" (Clean, spaced out, progress indicators).
*   If not, create a skeleton component following the spec.

## 4. Verification
*   Check mobile responsiveness for the Sticky Trust Bar.
*   Ensure contrast ratios meet accessibility standards (AA).
