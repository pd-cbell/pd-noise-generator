# Roadmap v1.8: Simulation Realism & Major Incidents

This release focuses on shifting the simulation from "machine-like" regularity to "human-like" chaos. It introduces probabilistic behaviors for Major Incidents, imperfect responder actions (missed acks), and robust state synchronization with PagerDuty.

---

## High-Level Goals
- **Major Incident Simulation:** Randomly promote incidents to P1/P2 with "War Room" characteristics.
- **Human Behavior (Ack Rate):** Simulate missed alerts and escalation delays.
- **State Synchronization:** Actively detect and handle incidents merged or resolved externally by real users.
- **UI Enhancements:** Add configuration controls for Major Incident Probability and Ack Rate.

---

## Phase 1: The Human Factor (Simulation Logic)

### 1.1 Major Incident Promotion
- **Configuration:** Add `majorIncidentProbability` (0-10%) slider to `ConfigurationForm`.
- **Logic (`ServerSimulationEngine.ts`):**
    - On incident creation, roll dice against probability.
    - **If Major:**
        - Force Severity: `critical`.
        - Set Priority: `P1` or `P2` (requires VIP/Standard PagerDuty plan features, ensure graceful fallback).
        - **Swarming:** Request *multiple* responders (e.g., 3 random users) instead of just one.
        - **Chatter:** Inject "War Room" notes (e.g., "Sev1 call bridge opened", "Executive comms sent").
        - **Duration:** Extend resolution time significantly (e.g., 2x - 5x normal).

### 1.2 Imperfect Responder (Ack Rate)
- **Configuration:** Add `responderAckRate` (0-100%, default 90%) slider.
- **Logic (`ServerSimulationEngine.ts`):**
    - When `autoAckAt` time arrives:
        - Roll dice against `responderAckRate`.
        - **If Pass:** Acknowledge as normal.
        - **If Miss (Fail):**
            - **Skip Ack:** Do not send `acknowledge` event.
            - **Escalate (Simulated):** Schedule a "Secondary Ack" time (e.g., +5-15 minutes) representing the next person on call or a manager stepping in.
            - **Log:** "Responder missed alert (Simulated fatigue). Escalating..."

---

## Phase 2: Robust State Synchronization

### 2.1 Active State Polling
- **Goal:** Handle incidents merged or resolved manually by users in the PagerDuty UI.
- **Issue:** Webhooks/Sockets might be missed, or the simulator might try to act on a stale ID.
- **Logic (`ServerSimulationEngine.ts`):**
    - **Poll Loop:** Every `N` ticks (e.g., every 10 seconds), perform a "Liveness Check" on a batch of active incidents.
    - **API Check:** `GET /incidents?ids[]=...&status=resolved,triggered,acknowledged`.
    - **Reconciliation:**
        - If API says `resolved` but local is `active` -> Remove locally.
        - If API returns 404 (or ID missing from response) -> Remove locally (assumed merged/deleted).
        - If API says `acknowledged` but local is `triggered` -> Update local state (sync).

---

## Phase 3: User Interface Updates

### 3.1 Configuration Form
- Update `ConfigurationForm.tsx` to include:
    - **"Major Incident Rate"** slider (0% - 10%).
    - **"Responder Ack Rate"** slider (0% - 100%).
- Update `useStore` and `types.ts` to persist these new settings.

---

## v1.8.1 (Future): Seasonality & Shifts
- **Shift Handoffs:** Increase MTTA/MTTR during specific "shift change" windows (e.g., 8am/8pm).
- **Seasonality:** Configure traffic patterns (e.g., higher noise during business hours, lower at night/weekends) to simulate realistic load fluctuations.

---

## Deliverables
- [ ] Simulator randomly generates Major Incidents with swarming and chatter.
- [ ] Simulator skips acks based on configurable rate, simulating human error.
- [ ] Dashboard automatically clears incidents resolved/merged externally within ~10 seconds.
- [ ] UI provides controls for new probability settings.
