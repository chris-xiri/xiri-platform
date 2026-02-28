# XIRI Facility Solutions — Brand Kit

> **One Call. One Invoice. Total Facility Coverage.**

---

## Brand Identity

| Attribute      | Value                       |
| -------------- | --------------------------- |
| Brand Name     | **XIRI**                    |
| Full Name      | XIRI Facility Solutions     |
| Tagline        | *Facility Solutions*        |
| Website        | xiri.ai                     |

---

## Color Palette

### Primary Colors

| Role               | Hex         | Swatch                           | Usage                                      |
| ------------------ | ----------- | --------------------------------- | ------------------------------------------ |
| **Primary**        | `#0369a1`   | 🟦                                | Wordmark text, primary brand color         |
| **Primary Light**  | `#0284c7`   | 🟦                                | Gradient start, icon accent                |
| **Primary Dark**   | `#0c4a6e`   | 🟦                                | Deep backgrounds, banner gradient start    |
| **Accent / Sky**   | `#38bdf8`   | 🔵                                | CTAs, highlights, accent lines, badges     |

> [!NOTE]
> The primary palette lives in the **Sky/Cyan** family (Tailwind `sky-600` → `sky-900`).

### Neutral Colors

| Role               | Hex         | Usage                                       |
| ------------------ | ----------- | ------------------------------------------- |
| **Subtitle Gray**  | `#6b7280`   | Tagline text (*FACILITY SOLUTIONS*)         |
| **Divider Gray**   | `#e5e7eb`   | Horizontal rule separators on light backgrounds |
| **Background**     | `#ffffff`   | Default light background                    |
| **Foreground**     | `#171717`   | Default body text                           |
| **Dark BG**        | `#0a0a0a`   | Dark-mode background                        |
| **Dark FG**        | `#ededed`   | Dark-mode body text                         |

### Brand Gradient

Used on icon badges, square logos, service showcase cards, and Facebook banners:

```
Direction:  top-left → bottom-right  (x1="0%" y1="0%" → x2="100%" y2="100%")
Stop 1:     #0284c7  (0%)     — Primary Light
Stop 2:     #0369a1  (100%)   — Primary
```

For deep/dark backgrounds (banners, services card):

```
Stop 1:     #0c4a6e  (0%)     — Primary Dark
Stop 2:     #0369a1  (100%)   — Primary
```

Three-stop expanded variant (Facebook cover):

```
Stop 1:     #0c4a6e  (0%)
Stop 2:     #0369a1  (40%)
Stop 3:     #0284c7  (100%)
```

---

## Fonts & Typography

### Font Families

The brand uses two Google Fonts, loaded via `next/font/google` in `layout.tsx`:

| Font       | Role               | CSS Variable     | Tailwind Class   | Google Fonts Link                                          |
| ---------- | ------------------ | ---------------- | ---------------- | ---------------------------------------------------------- |
| **Inter**  | Body / Default     | `--font-inter`   | `font-sans`      | [Inter](https://fonts.google.com/specimen/Inter)           |
| **Outfit** | Headings / Display | `--font-outfit`  | `font-heading`   | [Outfit](https://fonts.google.com/specimen/Outfit)         |

Both are loaded with `subsets: ["latin"]` and `display: "swap"`.

### Font Weights in Use

| Weight | Name        | Where Used                                                       |
| ------ | ----------- | ---------------------------------------------------------------- |
| 300    | Light       | Banner tagline ("One Call. One Invoice. Total Facility Coverage") |
| 400    | Regular     | Body text, tagline subtitle (*FACILITY SOLUTIONS* in logos)       |
| 500    | Medium      | Tagline labels, service card subtitles                            |
| 600    | Semi-Bold   | Badge text, accent pill labels, service pill labels               |
| 700    | Bold        | Section label text, `font-heading` headings                       |
| 800    | Extra Bold  | **XIRI** wordmark across all logo variants                        |

### Typography Rules

| Element              | Font                                              | Weight | Size (reference) | Tracking         |
| -------------------- | ------------------------------------------------- | ------ | ---------------- | ---------------- |
| **Page Headings**    | Outfit (`font-heading`)                           | 700    | text-3xl–5xl     | `tracking-tight` |
| **Wordmark "XIRI"** | `'Inter', 'Helvetica Neue', Arial, sans-serif`    | 800    | 42–84 px         | `-1` to `-2`     |
| **Tagline**          | `'Inter', 'Helvetica Neue', Arial, sans-serif`    | 400–500 | 9–15 px         | `+2.5` to `+5`  |
| **Body text**        | Inter (`font-sans`) / fallback `Arial, Helvetica` | 400    | base             | default          |
| **Code / Data**      | System mono stack (`font-mono`)                   | 400    | text-xs–sm       | default          |

> [!IMPORTANT]
> - The wordmark always uses **Extra Bold (800)** with **negative letter-spacing** (tight).
> - The tagline *FACILITY SOLUTIONS* always uses **wide letter-spacing** and lighter weight.
> - This contrast between tight/bold wordmark and spaced/light tagline is a core brand mechanic.
> - Page headings (h1, h2, h3) use **Outfit** (`font-heading`), not Inter.

### Font Loading (layout.tsx)

```tsx
import { Inter, Outfit } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

// Applied to <body>:
// className={`${inter.variable} ${outfit.variable} font-sans antialiased`}
```

---

## Logo System

All logos are SVG, live in `apps/public-site/public/`, and follow a consistent naming convention.

### Logo Variants at a Glance

| Variant                   | File                       | Dimensions  | Best For                           |
| ------------------------- | -------------------------- | ----------- | ---------------------------------- |
| **Icon Mark**             | `logo-icon.svg`            | 48 × 48     | Favicons, app icons, small UI      |
| **Square Badge**          | `logo-square.svg`          | 180 × 180   | App stores, profile plates         |
| **Wordmark Only**         | `logo-wordmark.svg`        | 130 × 48    | Compact horizontal, nav bars       |
| **Full Horizontal**       | `logo-full.svg`            | 320 × 80    | Headers, documents, email sigs     |
| **Full Horizontal (White)** | `logo-full-white.svg`    | 320 × 80    | Dark backgrounds                   |
| **Vertical Stacked**      | `logo-vertical.svg`        | 160 × 120   | Cards, letterheads, centered       |
| **Vertical Stacked (White)** | `logo-vertical-white.svg` | 160 × 120 | Dark backgrounds                   |
| **Combined (Icon + Text)** | `logo-combined.svg`       | 200 × 60    | Primary inline logo                |
| **Combined (White)**      | `logo-combined-white.svg`  | 200 × 60    | Dark backgrounds                   |
| **Facebook Profile**      | `logo-facebook.svg`        | 320 × 320   | Facebook profile picture (circular)|

### Logo Anatomy

```
  ┌──────────────────────────────────────────────┐
  │  ┌─────────┐                                 │
  │  │ Icon    │   XIRI              ← Wordmark  │
  │  │  "X"    │   FACILITY SOLUTIONS ← Tagline  │
  │  └─────────┘                                 │
  └──────────────────────────────────────────────┘
       ↑ Gradient badge        ↑ #0369a1 / white
         (rx: 9–10)            ↑ #6b7280 / white@0.65–0.7
```

**Icon Badge:**
- Rounded rectangle (`rx="9"` or `rx="10"`)
- Filled with the brand gradient
- White **"X"** monogram centered, weight 800

**White-on-Dark Variants:**
- Wordmark → `#ffffff`
- Tagline → `rgba(255,255,255,0.65)` to `rgba(255,255,255,0.7)`
- Icon badge → frosted glass gradient: `rgba(255,255,255,0.25)` → `rgba(255,255,255,0.12)`
- Dividers → `rgba(255,255,255,0.2)`

---

## Social Media Assets

| Asset                    | File                        | Dimensions  | Format     |
| ------------------------ | --------------------------- | ----------- | ---------- |
| **Facebook Cover**       | `facebook-banner.svg`       | 820 × 360   | SVG        |
| **Facebook Cover (raster)** | `facebook-banner.png`    | —           | PNG        |
| **Facebook Profile**     | `logo-facebook.svg`         | 320 × 320   | SVG        |
| **Facebook Profile (raster)** | `logo-facebook.png`    | —           | PNG        |
| **OG / Partner Card**    | `og-partner-onboarding.png` | —           | PNG        |
| **Services Showcase**    | `logo-services.svg`         | 560 × 320   | SVG        |

### Facebook Banner Design Notes

- Three-stop gradient background (`#0c4a6e` → `#0369a1` → `#0284c7`)
- Layered grid + diagonal stripe texture at very low opacity
- Subtle `#38bdf8` glow ellipses for depth
- Service pills with frosted-glass appearance
- Bottom accent stripe: `#38bdf8` at 60% opacity
- Quality badges: *Nightly Audits · Weekly Visits · HIPAA*

---

## Design Patterns & Textures

### Frosted Glass / Glassmorphism

Used on dark backgrounds for cards and badges:

```css
background:   linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.04));
border:       1px solid rgba(255,255,255,0.12);
border-radius: 12px;
filter:       drop-shadow(0 2px 4px rgba(0,0,0,0.25));
```

### Grid Pattern

A subtle grid overlay used as a background texture:

```css
/* grid-pattern.svg — 100×100 unit cell */
stroke: currentColor;
stroke-width: 1;
opacity: 0.1;
```

### Micro-Dot Pattern (Services Card)

```css
/* 24×24 dot grid */
fill: rgba(255,255,255,0.06);
circle radius: 0.7px;
```

### Accent Glow

Soft radial ellipses in `rgba(56,189,248,0.08)` to `rgba(56,189,248,0.1)` placed behind content for depth on dark layouts.

### Animations

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 0.3s ease-out; }
```

---

## Quick Reference — CSS Variables

Defined in `globals.css`:

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

---

## Consistency Audit

### ✅ Fixed

| Issue | File | Fix |
| ----- | ---- | --- |
| `font-heading` class used on ~15+ pages but never defined in Tailwind | `tailwind.config.ts` | Added `fontFamily.heading` → `var(--font-outfit)` |
| `font-sans` resolved to system stack instead of Inter | `tailwind.config.ts` | Added `fontFamily.sans` → `var(--font-inter)` |
| Body had hardcoded `Arial, Helvetica, sans-serif` bypassing Inter | `globals.css` | Removed `font-family` from body; Tailwind `font-sans` on `<body>` handles it |

### ✅ Already Consistent

- **Colors** — All components use Tailwind `sky-600` / `sky-700` classes, which align with brand hex `#0284c7` / `#0369a1`.
- **Logo SVGs** — All 10 logo files use the same `Inter` font stack (`'Inter', 'Helvetica Neue', Arial, sans-serif`).
- **Gradients** — All icon badges and square logos use the same `#0284c7` → `#0369a1` gradient direction.
- **Tagline** — Consistently rendered as uppercase with wide tracking in every variant.
- **White variants** — All use matching opacity values (`rgba(255,255,255,0.65–0.7)`).

---

## Usage Guidelines

> [!CAUTION]
> **Do not** modify the wordmark letter-spacing to positive values.
> The tight tracking on **XIRI** is a deliberate brand signature.

1. **Minimum size** — The icon mark (`logo-icon.svg`) should not be rendered smaller than 24 × 24 px.
2. **Clear space** — Maintain at least 50% of the icon width as clear space around any logo variant.
3. **Color on color** — Always use the white variants (`*-white.svg`) on dark or gradient backgrounds.
4. **Gradient direction** — The brand gradient always flows **top-left → bottom-right**.
5. **Tagline casing** — *FACILITY SOLUTIONS* is always **uppercase** with wide tracking.
6. **Font loading** — Use [Google Fonts Inter](https://fonts.google.com/specimen/Inter) (weight 400, 500, 600, 700, 800).
