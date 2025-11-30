# Roadmap v1.8.2: Incident Merging & Priority Variance

This release focuses on refining the "Major Incident" behavior to be less deterministic and simulating intelligent noise reduction via incident merging.

## High-Level Goals
- **Varied Priorities:** "Major" incidents should not always be P1. They should follow a distribution (e.g., P1, P2, P3) to simulate different levels of urgency within a major failure.
- **Simulated Intelligent Merging:** Incidents generated as part of a "Team Failure Scenario" should be automatically merged into a single parent incident to simulate Content-Based Alert Grouping (CBAG) or human triage.
- **Contextual Notes:** Add notes to merged incidents indicating that related alerts were identified and grouped.

## Phase 1: Varied Priorities for Major Incidents
- **Current Logic:** If `isMajor` is true, the simulator forces Priority = `P1`.
- **New Logic:**
    - Define a weighted distribution for Major Incidents:
        - **P1:** 30%
        - **P2:** 50%
        - **P3:** 20%
    - Update `ServerSimulationEngine.ts` to select the target priority based on these weights before calling `updateIncidentPriority`.

## Phase 2: Incident Merging (Team Failures)
- **Goal:** When a Team Failure Scenario triggers 3-5 incidents, merge them into one "Parent" incident.
- **Challenge:** Incidents are created via the Events API (async) and don't have IDs immediately.
- **Implementation:**
    1.  **Refactor `triggerTeamFailureScenario`:**
        - Generate `dedupKey`s for all intended incidents upfront.
        - Create a `PendingMerge` object: `{ targetDedupKey: string, sourceDedupKeys: string[], createdAt: number }`.
        - Store this in `SimulationInstance.pendingMerges` array.
    2.  **Update `tick()`:**
        - Iterate through `pendingMerges`.
        - Check if all `dedupKeys` (target + sources) have been mapped to `incidentId`s in `activeIncidents`.
        - If **Ready**:
            - Call `pdClient.mergeIncidents(sourceIds, targetId)`.
            - Add Note to Target: "Intelligent Grouping: ${sourceIds.length} related incidents merged based on Team Failure pattern."
            - Remove from `pendingMerges`.
        - If **Timeout** (e.g., > 60s): Discard the merge attempt (safety valve).
    3.  **Update `PagerDutyClient.ts`:**
        - Add `mergeIncidents(targetId: string, sourceIds: string[])` method.

## Phase 3: UI/Logging
- **Dashboard:**
    - Log when a merge event occurs: "Merged 3 incidents into [Incident ID] (Team Failure)."
    - Ensure merged incidents (that disappear from PD active list) are removed from the local simulator list gracefully.

## Deliverables
- [ ] Major incidents use P1/P2/P3 distribution.
- [ ] Team Failure incidents are merged into a single parent.
- [ ] Notes are added explaining the merge.
