# Roadmap v1.7.2: Dashboard Visibility & Import Fixes

This plan addresses immediate UX and functional issues identified during initial testing of the v1.7 replatform, focusing on improving dashboard visibility and providing better user feedback for campaign imports.

---

## High-Level Goals
- Ensure the Active Incident trend graph updates correctly.
- Provide filtering capabilities for the System Log to reduce noise.
- Improve user feedback and reliability for the Crux campaign import feature.
- Fully enable PagerDuty Responder Requests.
- Handle external incident updates (resolves/merges) gracefully.
- Ensure "Clear All" and "Resolve All" buttons function correctly.

---

## Phase 1: Dashboard Visibility & Logic Enhancements

### 1.1 Fix Active Incident Trend Chart
- **Issue:** The `monitorTrend` graph is not updating properly.
- **Cause Analysis:**
    - The `MonitorDashboard` correctly consumes `currentSimState?.monitorTrend`.
    - The primary issue is likely that `monitorTrend` is an empty array (`[]`) in the `SimulationState` passed from the server.
- **Backend (`ServerSimulationEngine.ts`):**
    - **Logic:** Implement `addMonitorTrendData()` method within `SimulationInstance` (similar to `useStore`'s client-side version).
    - **Integration:** Call `addMonitorTrendData()` at the end of `tick()` (or every few seconds) to push `activeIncidents.length` to `state.monitorTrend`.
    - **Cleanup:** Ensure `monitorTrend` array maintains a sliding window (e.g., last 15 minutes of data points).

### 1.2 Implement System Log Filtering
- **Issue:** The system log can be noisy, making it hard to spot warnings or errors.
- **Frontend (`MonitorDashboard.tsx`):**
    - **UI:** Add filter buttons (e.g., "All", "Info", "Warn", "Error") above the log display.
    - **State:** Manage a local `logFilterLevel` state ('all' | 'info' | 'warn' | 'error').
    - **Logic:** Filter the `currentSimState?.log` array based on `logFilterLevel` before rendering.

### 1.3 Handle External Resolves/Merges
- **Issue:** If a user manually resolves or merges an incident in PagerDuty, the simulator might keep trying to update it, leading to errors or stale state.
- **Backend (`ServerSimulationEngine.ts`):**
    - **Response Inspection:** When `ackIncident` (single or batch) receives a response from PagerDuty, inspect the status of the returned incident(s).
    - **Reconciliation:** If an incident in our `activeIncidents` list returns with `status: 'resolved'` (and we didn't just initiate a resolve), immediately remove it from our active list.
    - **Error Handling:** If an API call returns 404 (Incident Not Found, potentially Merged/Deleted) or 400 (e.g., "Incident is already resolved"), catch that specific error and remove the incident from the active list to stop further attempts.

### 1.4 Fix "Clear All" and "Resolve All" Buttons
- **Issue:** The "Clear List (Server)" and "Resolve All (Server)" buttons on the Monitor Dashboard do not function.
- **Cause Analysis:** These actions must trigger server-side logic to correctly manipulate the `SimulationInstance` state and PagerDuty.
- **Frontend (`MonitorDashboard.tsx`):**
    - **Logic:** Ensure the `clearActiveIncidents` and `resolveAllIncidents` functions from `useServerSimulation()` are correctly invoked via socket events.
- **Backend (`ServerSimulationEngine.ts`):**
    - **`clearActiveIncidents()`:** Verify this method correctly clears `this.state.activeIncidents` and emits the updated state.
    - **`resolveAllIncidents()`:** Verify this method correctly queues all active incidents for resolution and clears `this.state.activeIncidents` locally. Ensure the batch API calls for resolution are being sent and handled.

---

## Phase 2: Import & Responder Fixes

### 2.1 Improve Import Crux User Feedback
- **Issue:** The current backend import process is silent on the frontend.
- **Frontend (`CampaignManager.tsx`):**
    - **Loading State:** Implement a local loading state for the import button, showing a spinner while `api.importCampaigns` is in progress.
    - **Toast/Alert Feedback:** Use `addLog` (client-side Zustand) for prominent notifications (success/error/progress).
    - **Error Handling:** Ensure `try/catch` around `api.importCampaigns` clearly communicates failures to the user.

### 2.2 Fully Enable Responder Requests
- **Issue:** Responder requests are currently skipped on the server side.
- **Backend (`PagerDutyClient.ts`):**
    - Add `requestResponder(incidentId: string, requesterId: string, message: string)` method.
- **Backend (`ServerSimulationEngine.ts`):**
    - **User ID Cache:** Implement a mechanism to resolve a `fromEmail` to a PagerDuty User ID (using `pdClient.getUsersByEmail`) once and cache it for the `SimulationInstance`. This happens when the simulation starts or `fromEmail` changes.
    - **Logic:** Implement the `requestResponder` logic in `tick()`, using the resolved `requesterId` from the cache. Handle potential failures gracefully.

---

## Deliverables for v1.7.2
- Active Incident trend chart displays real-time data from the server.
- System log in Monitor tab is filterable by log level.
- Crux import provides visual feedback (loading, success/error).
- PagerDuty Responder Requests are fully functional.
- Simulator gracefully handles externally resolved/merged incidents.
- "Clear All" and "Resolve All" buttons correctly trigger server-side actions.

This plan aims to polish the user experience and enable all intended features for a robust v1.7.2 release.
