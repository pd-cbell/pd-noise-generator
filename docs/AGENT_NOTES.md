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

## Key Files
- `client/src/store/useStore.ts`: The brain. Holds all configuration, metrics, and actions (`ackIncident`, `triggerIncident`).
- `client/src/services/SimulationEngine.ts`: The heart. Manages the `setTimeout` loops for generation and `setInterval` for evaluation.
- `client/src/components/MonitorDashboard.tsx`: The face. Visualizes active incidents, logs, and detailed metric cards.
- `server/src/routes/proxy.ts`: The gateway. Handles PagerDuty API interactions to avoid CORS and manage auth headers.

## Common Pitfalls
- **Metric Calculation:** MTTA/MTTR are rolling averages updated in-memory. A page reload resets them (by design, for "session" stats).
- **API Rate Limits:** The simulator can be aggressive. `apiRpm` metric helps monitor this. The proxy has basic error handling but no aggressive backoff queue yet.
- **Pause Behavior:** Pause stops *new* noise but continues to "work" existing noise. This is intentional to allow a queue to drain naturally or be worked manually.

## Testing Guidance
- **Manual:** Use the "Trigger Now" buttons in Campaign Manager or "Start" simulation. Verify stats update on the Dashboard.
- **Pause:** Click "Pause" and verify "Active Incidents" count stabilizes (decreases as they resolve, doesn't increase).
- **Database:** Use `npx prisma studio` in `server/` to inspect persisted profiles/campaigns.
