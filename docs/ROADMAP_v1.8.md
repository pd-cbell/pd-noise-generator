# Roadmap v1.8: High Fidelity Simulation & Major Incidents

This milestone focuses on increasing the realism of the simulation by mimicking human behavior (imperfections, on-call schedules) and exercising complex Major Incident Response processes.

---

## Phase 1: Human Behavior Simulation

### 1.1 Probabilistic Acknowledgement (Escalation Testing)
- **Goal:** Simulate real-world scenarios where engineers miss alerts, causing escalations.
- **Configuration:**
    - Add "Ack Success Rate" slider (0-100%, default 100%) to Global/Severity settings.
- **Logic:**
    - When an incident reaches its `autoAckAt` time:
        - Roll a random number.
        - **Pass:** Perform `ackIncident` as usual.
        - **Fail:** Do nothing. Log "Missed Ack - Waiting for Escalation".
    - **Result:** The incident remains Triggered. PagerDuty's internal Escalation Policy logic will take over, notifying the next level. This validates the EP configuration.

### 1.2 Smart Responder Context (On-Call Awareness)
- **Goal:** Acknowledge incidents as the actual on-call engineer, not a generic automation user.
- **Implementation:**
    - **API:** Utilize `GET /oncalls` to fetch the currently assigned user for the incident's Escalation Policy (Level 1).
    - **Action:**
        - *Option A (Ideal):* Use the `From:` header with the on-call user's email (requires `perform_as` permission or User Token).
        - *Option B (Fallback):* Acknowledge as the "Automation User" but add a Note: "Simulated Ack by [On-Call Name]".
        - *Option C (Assignment):* Reassign the incident to the on-call user before Acking.

---

## Phase 2: Major Incident (Sev-2) Simulation

### 2.1 The "Big One" Scheduler
- **Goal:** Periodically generate a high-impact incident that requires coordinated response.
- **Configuration:**
    - Toggle: "Enable Major Incidents".
    - Frequency: "Every X minutes" (default 15-30m).
    - Target: Randomly select an active Critical incident or trigger a new one.

### 2.2 Major Incident Lifecycle
- **Promotion:**
    - Update Incident Priority to **P1** or **P2** (requires fetching `GET /priorities` to map IDs).
- **Workflow Simulation:**
    1.  **Declare:** Add a Note or Custom Field indicating "Major Incident Declared".
    2.  **Mobilize:** Automatically request *multiple* responders (e.g., "Database Team", "SRE Team").
    3.  **Communication:**
        - Post **Status Updates** (`POST /incidents/{id}/status_updates`) every 5-10 minutes.
        - "Investigating root cause..." -> "Identified issue..." -> "Fix implementing..." -> "Monitoring...".
    4.  **Duration:** Override standard MTTR. These incidents should persist for 45-90 minutes.

---

## Phase 3: Advanced Workflows & Integrations

### 3.1 Flapping Services
- **Goal:** Test Event Intelligence suppression.
- **Logic:** Select a service to "flap".
    - Trigger -> Wait 2m -> Resolve -> Wait 1m -> Trigger...
    - Verify if PagerDuty merges these or alerts repeatedly.

### 3.2 Business Status Updates
- **Goal:** Populate the Status Dashboard.
- **Logic:** When a Major Incident is active, post updates that are visible to stakeholders (simulating the Business Response role).

---

## Technical Requirements
- **New API Clients:**
    - `OnCallsClient`: To lookup on-call users.
    - `PrioritiesClient`: To map P1/P2.
    - `StatusUpdateClient`: To post business updates.
- **Database Schema:**
    - `SimulationConfig` expansion for Ack Rates and Major Incident settings.
    - `MajorIncidentProfile`: Configuration for how a major incident looks (teams to summon, templates for updates).

This release moves the tool from a "Noise Generator" to a full "Process Simulator".
