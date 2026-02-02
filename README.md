# Xiri Platform

This is the Xiri Platform monorepo.

## Project Structure

- `apps/xiri-web`: React + Vite frontend.
- `packages/functions`: Firebase Cloud Functions.

## Deployment

### Frontend (Vercel)

This project is configured for Vercel. When importing to Vercel, use the following settings:

- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `npx turbo run build --filter=xiri-web`
- **Output Directory**: `apps/xiri-web/dist`

### Backend (Firebase Functions)

To deploy backend functions:

```bash
cd packages/functions
npm run deploy
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Start Firebase emulators:
   ```bash
   firebase emulators:start
   ```
