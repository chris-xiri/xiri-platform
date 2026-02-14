# 🤖 Agent Governance: The "Prime Directives"

## 1. The "One Key Ring" Rule (Environment Variables)
*   **NEVER** create `.env` or `.env.local` files in sub-directories (`apps/*` or `packages/*`).
*   **ALWAYS** read/write from the **ROOT** `k:\Repos\xiri-platform\.env.local`.
*   **WHY**: The `npm run dev` command references `scripts/sync-env.js`, which auto-distributes keys to the correct locations.
*   **IF** you need a new key, add it to the Root `.env.local` and restart the dev server.

## 2. The "Schema First" Rule
*   **NEVER** invent new data types in components.
*   **ALWAYS** use types from `@xiri/shared`.
*   **IF** a type is missing, you must updated `packages/shared/src/index.ts` first.

## 3. The "Design System" Rule
*   **NEVER** use raw hex colors (e.g., `#0284c7`).
*   **ALWAYS** use the Tailwind semantic tokens: `text-sky-600` (Medical), `text-teal-500` (Surgical).
*   **consult** `architecture/design_system_spec.md` before building UI.
