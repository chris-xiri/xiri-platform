# Server Stability Protocol & Agent Instructions

**IMPORTANT**: All agents (Marketing, Ops, Full) MUST follow these protocols to prevent server crashes and environment corruption.

## 1. Port Architecture (DO NOT CHANGE)

We use specific ports to avoid conflicts. **Do not assume defaults.**

| Service | Port | Notes |
| :--- | :--- | :--- |
| **Emulator UI** | `4001` | The main Firebase dashboard. |
| **Authentication** | `9099` | `http://127.0.0.1:9099` |
| **Firestore** | `8085` | **CRITICAL**: Default is 8080, but we use **8085**. All scripts must target `8085`. |
| **Functions** | `5001` | Cloud Functions emulator. |
| **Dashboard** | `3001` | `apps/dashboard` (Next.js) - STRICT |
| **Public Site** | `3000` | `apps/public-site` (Next.js) - STRICT |

### 🛑 CRITICAL RULE:
**NEVER** hardcode `8080` in scripts. Always check `firebase.json` or use `process.env.FIRESTORE_EMULATOR_HOST` aiming at `8085`.

## 2. Startup Protocol (The "Clean" Way)

**NEVER** start applications individually inside their directories (e.g., `cd apps/dashboard && npm run dev`) unless you are debugging that specific isolation.

**ALWAYS** start from the root using Turbo:
```bash
# Root directory
npm run dev
```
This ensures:
1.  Environment variables are loaded correctly from root.
2.  Port offsets are managed by Turbo/Next.js.
3.  Emulators start alongside the apps.

## 3. The "Nuclear" Reset (Crash Recovery)

If servers are hanging, ports are blocked, or you see `EADDRINUSE`:

**DO NOT** just try to run it again.
**DO**:
1.  **Kill Zombie Processes**:
    ```powershell
    # Kill Node.js processes on dev ports
    taskkill /F /IM node.exe
    # OR find specific ports
    netstat -ano | findstr ":3000 :8085"
    taskkill /PID <PID> /F
    ```
2.  **Clear Caches** (If getting 404s/Hydration errors):
    ```powershell
    Remove-Item -Recurse -Force apps/dashboard/.next
    Remove-Item -Recurse -Force apps/public-site/.next
    ```
3.  **Restart**:
    ```bash
    npm run dev
    ```

## 4. Package & Identity Rules

- **Dashboard**: package name is `@xiri/dashboard`.
- **Public Site**: package name is `@xiri/public-site`.
- **Functions**: Node engine is `>=22`.

## 5. Seed Scripts

When creating or running seed scripts:
- Ensure they connect to `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`.
- Do not let them default to `8080`.

## 6. Data Persistence

The emulators are configured to persist data to `packages/functions/firebase-data`.

- **On Start**: Data is imported from this directory.
- **On Exit**: Data is exported to this directory.

### To Reset Data:
1.  Stop the server (`Ctrl+C`).
2.  Delete the folder: `packages/functions/firebase-data`.
3.  Restart the server.
4.  Run seed scripts.
