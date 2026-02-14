# 🧑‍💻 Engineer Prompt: Supply Engine Stabilization

**Context**: We need to "Harden" the Supply Engine (`apps/dashboard`) before launch.
**Spec**: `architecture/supply_stabilization_spec.md`
**Goal**: Make it fast, secure, and cleaner.

## 1. Limit the Query
*   Edit `apps/dashboard/src/components/VendorList.tsx`.
*   Update the `useEffect` hook. Change the Firestore query to include `limit(100)`.
*   *Why*: Prevent browser crashes on large datasets.

## 2. Fix the Campaign Launcher API
*   Edit `apps/dashboard/src/components/CampaignLauncher.tsx`.
*   Ensure `httpsCallable` specifies `{ region: 'us-central1' }` (or your function region) in the options object relative to the instance. Not as a second argument, but as an instance method call: `httpsCallable(functions, 'generateLeads', { timeout: 60000 })` is not quite right.
*   Correct usage: `httpsCallable(functions, 'generateLeads')`. Wait, verify your Firebase setup. If you are using `us-central1`, often the default is fine, but if you deployed to another region, you MUST specify it.
*   *Task*: Add explicit `timeout: 60000` to the call to handle long-running AI tasks.

### 2.1. Note on Google Places API
*   You will see a console warning about `google.maps.places.Autocomplete`.
*   **Action**: For now, ignore it (it works). 
*   **Future Task**: We will migrate to the new `<gmp-place-autocomplete>` Web Component in a dedicated sprint. Focus on the *Data Logic* first.

## 3. Refactor VendorList (Optional but Recommended)
*   Split the file. Create `components/VendorList/VendorRow.tsx` and `components/VendorList/VendorCard.tsx`.
*   Move the `filter` logic into a custom hook `useVendorFilter`.
