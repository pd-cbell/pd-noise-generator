# Roadmap v2.2.2 - Golden Demo Details & Mapping Preview

## Goal
Enhance the Director Soundboard to provide deep visibility into Golden Demos before launch. Users should be able to inspect the narrative and verify exactly how "Logical Services" (e.g., "Payments DB") map to "Real Services" (e.g., "Payments DB - Customer A") under the active profile.

## Features

### 1. Interactive Director Cards
*   **Action:** Clicking a Golden Demo card in `DirectorDashboard` will now open a details modal instead of immediately launching.
*   **Launch:** Move the "Launch" action to within the modal (primary call-to-action).

### 2. Golden Demo Detail Modal
*   **Component:** `GoldenDemoDetailModal`
*   **Header:** Displays Demo Name, Vertical, and Maturity Level.
*   **Narrative Section:** Full scrollable text of the demo's narrative.
*   **Service Mapping Preview Table:**
    *   Iterates through all events in the demo to extract unique logical services.
    *   Resolves each service against the *currently selected mapping profile*.
    *   **Columns:**
        *   **Logical Service:** Name used in the script (e.g., "Web App").
        *   **Event Types:** Icons/Badges (Incident vs. Change).
        *   **Mapped Service:** The actual resolved PagerDuty service name (e.g., "Web App - Prod").
        *   **Status:** Green check (Mapped & Key Present) or Red Warning (Unmapped/Missing Key).
    *   **Logic:** Implement a client-side `resolveServicePreview` utility that mimics the server's `MappingResolver` logic to provide instant feedback without API round-trips.

## Technical Implementation
*   **Client Logic:** Create `client/src/utils/mappingLogic.ts` to share/duplicate safe parts of the resolution logic (avoiding Prisma dependencies).
*   **State:** Use existing `goldenDemos` and `mappingProfiles` from Zustand store.

## User Value
*   **Confidence:** Eliminates "blind firing" of demos.
*   **Debugging:** Clear visualization of unmapped services *before* a demo fails.
