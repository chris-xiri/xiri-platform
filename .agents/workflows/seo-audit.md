---
description: Run an SEO audit and get recommendations for improving organic rankings. Feed it ranking data for analysis.
---

# SEO Pipeline: Technical Health → Ranking Audit → Strategy → Execution

This workflow runs as a 4-stage pipeline. You can run all stages in one session or stop after any stage for review.

**Cadence: Every 2 weeks** (set a recurring calendar reminder — Google changes take 7-14 days to reflect)

> **Skills used:** This workflow uses the `seo-audit` skill (global) for Stage 1 technical checks. Read its `SKILL.md` if you need the full checklist reference.

## Process Flow

```
┌─────────────────────────────────────────────────────────┐
│  YOU: trigger /seo-audit every 2 weeks                  │
│  (paste ranking data, screenshot, or run GSC script)    │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: TECHNICAL HEALTH CHECK (seo-audit skill)      │
│  • Crawlability: robots.txt, sitemap, architecture      │
│  • Indexation: canonicals, noindex, redirects            │
│  • Core Web Vitals: LCP, INP, CLS via PageSpeed         │
│  • On-page: titles, metas, headings, images, links      │
│  • Local SEO: NAP consistency, local schema              │
│  Output: Technical findings + priority fixes             │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 2: RANKING AUDIT                                  │
│  • Ingest ranking data (GSC JSON, CSV, or screenshot)   │
│  • Compare against tracked keywords                     │
│  • Check competitor sites for new content               │
│  • Identify wins, drops, and gaps                       │
│  Output: Ranking findings report                         │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STAGE 3: STRATEGY                                      │
│  • Merge technical fixes + ranking opportunities        │
│  • Prioritize by impact (volume × difficulty)           │
│  • Recommend specific new guides/pages                  │
│  • Suggest on-page fixes for existing pages             │
│  Output: Prioritized action list for user approval      │
└────────────────────────┬────────────────────────────────┘
                         ▼ (after user approves)
┌─────────────────────────────────────────────────────────┐
│  STAGE 4: EXECUTION                                     │
│  • Fix technical issues (canonicals, metas, speed)      │
│  • Create new guides in guides/[slug]/page.tsx          │
│  • Add internal links                                   │
│  • Build, commit, push                                  │
│  Output: Deployed changes + summary                     │
└─────────────────────────────────────────────────────────┘
```

---

## Stage 1: TECHNICAL HEALTH CHECK

> This stage follows the `seo-audit` skill checklist. XIRI context is pre-filled below — skip the skill's discovery questions.

### XIRI Site Context (pre-filled)
- **Site type:** Local B2B service business (janitorial/facility management)
- **URL:** https://xiri.ai
- **Framework:** Next.js 15 (App Router, Vercel-hosted)
- **SEO goal:** Rank for 34 target keywords across 4 tiers (see keyword reference below)
- **Competitors:** CBM Corp, Clear View, POC Corp, CommercialCleaningCorp, MethodCleanBiz, Coverall, JAN-PRO, SERVPRO, City Wide, Summit, One-A Cleaning, JanitorialLeadsPro
- **Known:** ~1,400 pages in sitemap, programmatic SEO pages, JSON-LD structured data

### 1a. Crawlability & Indexation
Check these XIRI-specific items:
- Fetch `https://xiri.ai/robots.txt` — verify no accidental blocks
- Fetch `https://xiri.ai/sitemap.xml` — verify it loads, count URLs, check for non-canonical or noindex pages
- Spot-check 3-5 programmatic pages (service×location) for proper canonical tags
- Check for redirect chains on any recently consolidated pages (e.g., old `/partners` → `/contractors`)

### 1b. Core Web Vitals
Use PageSpeed Insights API or browser tool on these representative pages:
- Homepage: `https://xiri.ai`
- A service page: `https://xiri.ai/services/janitorial-cleaning-in-garden-city`
- Calculator: `https://xiri.ai/calculator`
- A guide: `https://xiri.ai/guides/commercial-cleaning-cost`

Flag any page with:
- LCP > 2.5s
- INP > 200ms
- CLS > 0.1

### 1c. On-Page Spot Check
For the top 5 highest-traffic pages (from GSC data if available, otherwise homepage + calculator + top guides):
- Title tag: unique, primary keyword near beginning, 50-60 chars
- Meta description: unique, 150-160 chars, includes keyword
- H1: one per page, matches primary keyword
- Images: alt text present, WebP format, lazy loading
- Internal links: at least 3 contextual links to other XIRI pages

### 1d. Local SEO Check
- Verify Organization schema in `layout.tsx` includes correct NAP (Name, Address, Phone)
- Verify `sameAs` array includes Facebook + LinkedIn URLs
- Check Google Business Profile link consistency (if applicable)

### 1e. Output: Technical Health Report
Present findings as:
- ✅ **Passing** checks
- ⚠️ **Warnings** (non-blocking but should fix)
- 🔴 **Critical** (blocking ranking or indexation)

---

## Stage 2: RANKING AUDIT

### 2a. Ingest Ranking Data

Ask the user for their latest data. Accept any of these formats:

- **GSC script output**: `node scripts/pull-gsc-data.js` → reads `seo-data/gsc-rankings.json`
- **Screenshot**: from Google Search Console, Ahrefs, SEMrush, or any rank tracker
- **Pasted table**: keyword + position + clicks + impressions
- **CSV file**: dropped into the conversation

If the user ran the GSC script, read `seo-data/gsc-rankings.json` which contains:
- `topKeywords` — top 50 keywords by impressions
- `trackedKeywords` — performance on our 23 target keywords
- `improvementOpportunities` — page 2+ keywords with decent impressions

### 2b. Analyze Current State

For each keyword, classify into:
- 🟢 **Winning** (position 1-10): protect and strengthen
- 🟡 **Striking distance** (position 11-30): quick wins, push to page 1
- 🔴 **Not ranking** (position 30+ or absent): need new content or major fixes

Cross-reference against the existing site pages:
- `apps/public-site/app/guides/[slug]/page.tsx` — check GUIDES object for existing guides
- `apps/public-site/app/services/[slug]/page.tsx` — service/location DLPs
- `apps/public-site/app/solutions/[slug]/page.tsx` — solution DLPs
- `apps/public-site/app/calculator/page.tsx` — calculator page
- `apps/public-site/data/seo-data.json` — location/service data

### 2c. Competitor Check

Check these competitor sites for new content published since last audit:

| Competitor | URL | Check For |
|---|---|---|
| CBM Corp | cbmcorp.net | New blog posts (they publish ~3/week) |
| Clear View | clearviewbuildingservices.com | New blog posts, case studies |
| POC Corp | poccorp.net | New city-specific blog posts |
| CommercialCleaningCorp | commercialcleaningcorp.com | New facility manager guides |
| MethodCleanBiz | methodcleanbiz.com | New resources, calculator updates |
| Coverall | coverall.com | New city pages |
| JAN-PRO | jan-pro.com | New location pages |
| SERVPRO | servpro.com | New service pages |
| City Wide | gocitywide.com | New industry content |
| Summit | summit-facility-solutions.com | Any site changes |
| One-A Cleaning | one-acleaning.com | Any site changes |
| JanitorialLeadsPro | janitorialleadspro.com | New blog posts |

### 2d. Output: Ranking Report

Present findings as a structured summary:
- **Rankings snapshot** (how many keywords in each tier)
- **Biggest movers** (improved or dropped since last audit)
- **Competitor alerts** (new content from competitors)
- **Gap keywords** (high-volume keywords we're not targeting)

---

## Stage 3: STRATEGY

### 3a. Prioritize Actions

Merge findings from Stage 1 (technical fixes) and Stage 2 (ranking gaps) into a single prioritized list.

Score each opportunity by: `Impact = Search Volume × (1 / Difficulty) × Intent Score`

Intent Score:
- Transactional ("how much does X cost") = 3×
- Comparison ("X vs Y") = 2.5×
- Informational ("how to X") = 2×
- Navigational ("X company") = 1×

### 3b. Generate Recommendations

For each action, provide:

**For new guides:**
- Target keyword
- Suggested slug, title, H1
- Key sections (3-5)
- FAQ questions (3-4)
- Internal links to embed
- Which competitor this attacks

**For on-page fixes:**
- Current title vs. recommended title
- Current meta vs. recommended meta
- Missing keywords to add
- Internal links to add

**For DLP improvements:**
- Which locations need content enhancement
- Specific fields to update in seo-data.json

### 3c. Present Action Plan

Organize into:
1. **Quick Wins** (< 30 min, do today) — on-page fixes, internal links
2. **New Content** (1-2 hours, this week) — new guides
3. **Strategic** (this month) — location expansion, new page types

**PAUSE HERE** — present the strategy to the user and get approval before executing.

---

## Stage 4: EXECUTION

After user approves the strategy:

### 4a. Implement Changes

**Fixing technical issues (from Stage 1):**
- Fix broken canonicals, redirect chains
- Optimize images (WebP, alt text, lazy loading)
- Fix meta tags (titles, descriptions)
- Add missing internal links
- Fix any Core Web Vitals issues (image sizing, font loading, JS bundles)

**Adding new guides:**
Add entries to the `GUIDES` object in `apps/public-site/app/guides/[slug]/page.tsx`:

```typescript
'new-guide-slug': {
    title: 'Guide Title for SEO',
    heroTitle: 'H1 Title Targeting Primary Keyword',
    heroSubtitle: 'Supporting subtitle with secondary keyword',
    metaDescription: 'Meta description (150-160 chars) with primary keyword',
    sections: [
        { title: 'Section H2', content: 'Paragraph content...', items: ['bullet 1', 'bullet 2'] },
    ],
    calloutTitle: 'How XIRI Helps',
    calloutContent: 'XIRI value prop specific to this topic...',
    relatedServices: ['service-slug-1', 'service-slug-2'],
    faqs: [
        { question: 'FAQ targeting keyword variation?', answer: 'Comprehensive answer...' },
    ],
},
```

**On-page SEO fixes:**
- Edit metadata in the relevant page.tsx files
- Update FAQ entries in calculator page or guide pages
- Add internal links between pages

### 4b. Build and Verify
// turbo
1. Run `cd apps/public-site && npx next build` to verify no compilation errors

### 4c. Commit and Push
2. Commit: `git add -A && git commit -m "feat(seo): [description of changes]"`
3. Push: `git push origin main`

### 4d. Post-Deploy
After Vercel deploys:
- Suggest user submit new URLs to Google Search Console for indexing
- Note which keywords to watch in the next audit cycle

---

## Reminder Setup

I cannot schedule myself to run automatically. Set a **recurring calendar event**:

**Google Calendar / Outlook:**
- Title: `🔍 Run /seo-audit in Gemini`
- Frequency: Every 2 weeks (biweekly)
- Day: Monday mornings
- Notes: 
  ```
  1. Run: node scripts/pull-gsc-data.js
  2. Open Gemini, type: /seo-audit
  3. Paste the terminal output or share the screenshot
  ```

---

## Target Keyword Reference

### Tier 1: Money Keywords
- how much should office cleaning cost ✅
- how much does medical office cleaning cost
- how much does dental office cleaning cost
- janitorial cleaning cost calculator ✅
- commercial cleaning cost per square foot ✅
- how much does gym cleaning cost
- how to hire a janitorial company
- janitorial cleaning checklist
- janitorial cleaning cost ✅
- office cleaning cost ✅
- commercial cleaning rates ✅

### Tier 2: Comparison Keywords
- franchise vs independent cleaning company
- in-house vs outsourced janitorial ✅
- what to look for in a cleaning company
- how often should an office be cleaned
- best commercial cleaning company long island

### Tier 3: Local Keywords
- janitorial services [town] NY (64 towns) ✅
- medical office cleaning [town] (64 towns) ✅
- commercial cleaning nassau county ✅
- office cleaning cost [state]
