# AGENTS.md

## Repo Basics

- Workspace root: `K:\Repos\xiri-platform`
- Package manager: `npm` (`packageManager: npm@10.8.2`)
- Required Node.js version: `>=22`
- Monorepo layout:
  - `apps/public-site` runs on port `3000`
  - `apps/dashboard` runs on port `3001`
  - `packages/functions` uses the Firebase emulator stack
  - `tools/seo-agent` contains the SEO radar/analyzer tool

## Common Commands

```bash
npm install
npm run dev
npm run dev:public
npm run dev:dash
npm run build
npm run lint
npm run knip
npm run check:pseo-config
```

## Environment Workflow

- Run `npm run sync:env` before local app or functions work when root env values change.
- Source of truth is root `.env.local`.
- `scripts/sync-env.js` copies root `.env.local` to:
  - `apps/dashboard/.env.local`
  - `apps/public-site/.env.local`
  - `packages/functions/.secret.local`

## Local Workflows

- Full monorepo dev: `npm run dev`
  - Runs `scripts/sync-env.js` first, then `turbo dev --parallel`.
- Public site only: `npm run dev:public`
- Dashboard only: `npm run dev:dash`
- Functions local dev: `npm run dev -w @xiri/functions`
  - Starts `tsup --watch`
  - Starts `firebase emulators:start --config ../../firebase.json --import=../../firebase-data --export-on-exit`
  - Waits for Auth `9099` and Firestore `8085`, then seeds initial users/templates via `scripts/wait-and-seed.js`

## Data And Content Commands

- Translation sync: `npm run translate:sync`
  - Uses `GEMINI_API_KEY` and writes a human review file at `.translations-review.md`.
- pSEO config validation: `npm run check:pseo-config`
  - Verifies sitemap/static routes and pSEO field names against current app data/config.
- Shared market data refresh: `npm run refresh-data -w @xiri-facility-solutions/shared`
  - Regenerates `apps/marketing/lib/market-data.ts` and `apps/dashboard/src/lib/metro-wages.ts`.
- Public-site dataset refresh:
  - `npm run refresh-census -w @xiri/public-site`
  - `npm run refresh-open-data -w @xiri/public-site`

## SEO Agent

- Root shortcut: `npm run radar`
- Direct tool commands:
  - `npm run dev --prefix tools/seo-agent`
  - `npm run analyze --prefix tools/seo-agent`
  - `npm run radar --prefix tools/seo-agent`
