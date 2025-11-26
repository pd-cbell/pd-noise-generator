# Agent Notes

These notes help future pairing sessions or automation agents quickly orient themselves when working on the PagerDuty Incident Noise Simulator.

## Architecture & Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS. State management via Zustand (`useStore.ts`).
- **Backend:** Node.js + Express + TypeScript. Data persistence via PostgreSQL & Prisma.
- **Database:** PostgreSQL (via Docker Compose). Stores Profiles, Campaigns, and Campaign Items.
- **Legacy:** `App.jsx` and root `server.js` are obsolete. Development happens in `client/` and `server/` directories.

## Environment & Setup
- **Prerequisites:** Node 18+, Docker (for Postgres).
- **Start Dev:** `docker compose up -d` (db), then `cd server && npm run dev` and `cd client && npm run dev` (concurrently).
- **Credentials:** PagerDuty credentials (Token, Subdomain, Routing Key) are stored in the client's local state (Zustand) and persisted to `localStorage`.
- **Simulation Engine:** `SimulationEngine.ts` runs a Poisson process for incident generation and a 1Hz tick loop for lifecycle management (Auto-Ack/Resolve, Notes).

## Simulation Logic & State
- **Control States:**
  - **Running:** `isGenerating = true`, `isManaging = true`. Incidents are created and managed.
  - **Paused:** `isGenerating = false`, `isManaging = true`. No new incidents, but existing ones are auto-acked/resolved.
  - **Stopped:** `isGenerating = false`, `isManaging = false`. Engine loops are dormant.
- **Metrics:**
  - **MTTA/MTTR:** tracked per-severity (Warning, Error, Critical) and Global. Stored in `avgMtta` / `avgMttr` maps.
  - **API RPM:** Client-side tracking of outgoing API calls via `api.ts` hook. Calculated as a rolling rate in `evalTick`.
- **Configuration:**
  - **Per-Severity:** Distinct settings for Time-to-Ack, Time-to-Resolve, and probabilities (Notes, Responders) for Warning/Error/Critical.
  - **Global:** Throughput (Rate/min), API credentials, Auto-Heal (Warning suppression).

## Campaigns & Payloads
- **Campaigns:** Database-backed scenarios. Seeded from JSON templates. Logic handles complex event sequences (Change -> Alert -> Resolve).
- **Payloads:** `payloads.ts` generates high-fidelity JSON for integrations (CloudWatch, Datadog, NewRelic, etc.).
- **Change Events:** routed through `/proxy/change_events`.

## Roadmap

### v1.6.2 - Import Crux (Robust Re-attempt)
**Goal:** Safely integrate Crux campaign import functionality without introducing rendering issues.
**Lessons Learned from v1.6.1 failure:**
- Zustand's `persist` middleware can cause hydration timing issues, leading to `undefined` state variables on initial render.
- Components must be highly defensive when accessing store-derived state (e.g., `(variable || []).property` or optional chaining `variable?.property`).
- Large, multi-file changes are prone to errors if not tested incrementally.
**Strategy for re-attempt:**
1.  Isolate `importCampaignFromCrux` action and its types in `useStore.ts`.
2.  Implement robust null/undefined checks for *all* store-derived arrays/objects (`services`, `importedCampaigns`, `campaignConfig`, etc.) directly in `CampaignManager.tsx` and any other affected components.
3.  Add the UI elements (button, file input) only *after* the component is stable with the defensive checks.
4.  Test incrementally after each change.

### v1.6.1 - Campaign Editor UX & Zero-Config Webhooks (Complete)
- **Collapsible Steps:** Improve UI for long campaigns.
- **Named Steps:** Add `stepName` to schema.
- **Per-Step Routing:** Add `integrationKey` to schema for Change events.
- **JSON Tools:** Prettify/Validate JSON in editor.
- **Zero-Config Webhooks:** Added POST /api/campaigns/:id/trigger endpoint and UI for campaign-level incident routing key. (Note: API Token removal was also part of this refinement).

### v1.6 - High Fidelity & Control (Complete)
- **API RPM Enhancement:** Show current RPM + "Last 60s" total count.
- **Event Bursts:** Logic to send repeated events (same dedup_key).
- **Campaign Wiring:** Backend PUT endpoint added; Campaign Editor fully functional.

### v1.7 - Identity & Platform
- **Authentication:** Google OAuth integration.
- **User Profiles:** Link Settings/Profiles to authenticated Users.
- **UI Refactor:** Move "Org & Credentials" from Configure tab to a Header Dropdown/Profile Menu.

## Key Files
- `client/src/store/useStore.ts`: The brain. Holds all configuration, metrics, and actions.
- `client/src/components/CampaignEditor.tsx`: UI for creating/editing campaigns.
- `server/src/routes/campaigns.ts`: Backend CRUD for campaigns.
- `server/src/routes/proxy.ts`: The gateway. Handles PagerDuty API interactions.

## Common Pitfalls
- **Metric Calculation:** MTTA/MTTR are rolling averages updated in-memory. A page reload resets them (by design, for "session" stats).
- **API Rate Limits:** The simulator can be aggressive. `apiRpm` metric helps monitor this. The proxy has basic error handling but no aggressive backoff queue yet.
- **Pause Behavior:** Pause stops *new* noise but continues to "work" existing noise. This is intentional to allow a queue to drain naturally or be worked manually.

## Testing Guidance
- **Manual:** Use the "Trigger Now" buttons in Campaign Manager or "Start" simulation. Verify stats update on the Dashboard.
- **Pause:** Click "Pause" and verify "Active Incidents" count stabilizes (decreases as they resolve, doesn't increase).
- **Database:** Use `npx prisma studio` in `server/` to inspect persisted profiles/campaigns.