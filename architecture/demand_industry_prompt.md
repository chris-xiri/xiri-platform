# 🚀 Marketer Prompt: Industry Hub Strategy

**Context**: Pivot from "Service-First" to "Industry-First".
**Goal**: Build "Facility Landing Pages" that recommend a bundle of services.

## 1. Data Schema Update (`seo-data.json`)
You must restructure the data to support Industry Hubs.
Add an `industries` array:
```json
{
  "industries": [
    {
      "slug": "medical-offices",
      "name": "Medical Offices",
      "coreServices": ["medical-office-cleaning", "consumable-procurement", "floor-care"],
      "specializedServices": ["terminal-cleaning", "window-cleaning", "day-porter"]
    },
    // ... add Auto Dealerships, Schools, etc.
  ]
}
```

## 2. The Industry Hub Page (`app/[industry]/page.tsx`)
Create a new dynamic route.
*   **Hero**: "Complete Facility Management for [Industry Name]".
*   **The "Core Trio"**: Display 3 prominent cards for the `coreServices` (Cleaning, Consumables, Floor Care).
*   **Cross-Sell Grid**: Display `specializedServices` below.

## 3. Navigation Update
*   Update `components/Navigation.tsx`.
*   The "Facility Types" dropdown links should point to `/[industry]` (e.g., `/medical-offices`), NOT `/[service]`.

## 4. Execution Command
```bash
npm run dev:public
```
*Verify that clicking "Medical Offices" in the nav takes you to the new Hub Page.*
