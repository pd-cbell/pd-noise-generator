# Roadmap v1.8.1: Randomized Team Failure Scenarios & Realistic Personas

This release introduces "Randomized Team-Based Failure Campaigns" to simulate correlated outages, and "Realistic Responder Personas" to simulate actions from actual on-call users.

---

## High-Level Goals
- **Team-Based Failures:** Randomly trigger 3-5 incidents across services owned by a specific team.
- **Correlated Change Events:** Emit 1-3 change events for the affected team's services.
- **Realistic Responders:** Ack and Resolve incidents using the identities of users actually on-call for the service.
- **Configuration:** Add user control over team failure probability.

---

## Phase 1: Configuration & Logic (Team Failures)

### 1.1 Configuration
- **UI:** Update `ConfigurationForm` with a "Team Failure Probability" slider (0% - 5%, default 1%).
- **Store:** Add `teamFailureProbability` to `ConfigurationState` and `SimulationConfig`.

### 1.2 Simulation Logic (`ServerSimulationEngine.ts`)
- **Trigger Check:** In `tick()`, perform a probabilistic check against `teamFailureProbability`.
- **Scenario Execution:**
    1.  **Select Team:** Randomly pick a Team that has at least 2 services associated with it.
    2.  **Select Services:** Get the list of services for that team.
    3.  **Generate Incidents:** Trigger 3-5 incidents, randomly distributing them among the selected services. Stagger start times by 2-10 seconds.
    4.  **Generate Change Events:** Trigger 1-3 change events for services in that team. Stagger times.
    5.  **Logging:** Log "Started Team Failure Scenario for Team [Name]" to the dashboard.

---

## Phase 2: Realistic Responder Personas

### 2.1 On-Call Identity Spoofing
- **Goal:** Simulate actions (Ack/Resolve) coming from the actual users on-call for a service, rather than the single "Bot" user.
- **Logic (`ServerSimulationEngine.ts`):**
    - When performing an action (Ack/Resolve) in `tick()`:
        1.  Fetch On-Call users for the Incident's Service (`GET /oncalls?service_ids[]=...`).
        2.  Randomly select one user from the list.
        3.  Use their email in the `From` header of the REST API request.
    - **Optimization:** Cache On-Call users per service for a short duration (e.g., 5-15 minutes) to avoid API rate limits.
- **Fallback:** If the API Token lacks permissions to spoof users (returns 403), catch the error and retry immediately with the default configured `fromEmail`.

---

## Phase 3: Refinements (Future/Optional)
- **Dependency Mapping:** Traverse service dependencies instead of just Team grouping.
- **Scenario Templates:** Define "types" of team failures (e.g., "Database Lockup").

---

## Phase 4: Granular Major Incidents & Cascading Failures

### 4.1 Constrained Origin & Weighting
- **Goal:** Tie Major Incidents to systemic failures rather than random noise.
- **Constraint:** Major Incidents can **only** be triggered as part of a "Team Failure Scenario". Standard Poisson noise incidents are never Major.
- **Distribution (Weighted):**
    - **P1:** 10%
    - **P2:** 20%
    - **P3:** 70%
- **Logic (`ServerSimulationEngine.ts`):**
    - When a Team Failure starts, roll against `majorIncidentProbability`.
    - If Major, promote the incidents within this scenario to Critical and assign Priority based on weights.

### 4.2 Dynamic Activity Scaling
- **Scaling:**
    - **P1:** Swarm 5+ responders, frequent war room notes, 5x resolution duration.
    - **P2:** Swarm 3 responders, moderate notes, 3x resolution duration.
    - **P3:** Swarm 1-2 responders, occasional notes, 2x resolution duration.

### 4.3 Cascading Failures (Contagion)
- **Goal:** Simulate cascading outages where a major failure in one team impacts others.
- **Logic:**
    - If a Team Failure is **Major (P1/P2)**, it has a chance (e.g., 50%) to trigger "Team Failure Scenarios" for 1-2 *other* random teams.
    - **Delay:** These cascading failures should start 30-60 seconds after the primary failure.
    - **Depth:** Limit recursion to 1 level to avoid infinite loops (or use a decaying probability).

---

## Deliverables
- [ ] Simulator randomly generates Team Failure Scenarios.
- [ ] Simulator attempts to Ack/Resolve as On-Call users.
- [ ] UI allows configuration of failure probability.
- [ ] Dashboard logs indicate team scenarios and "acting as" users.