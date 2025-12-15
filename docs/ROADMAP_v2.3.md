# Roadmap v2.3: Multi-Sim Architecture & Cleanup

## Goals
1.  **Multi-Simulation Architecture:** Enable multiple concurrent, independent simulation "tracks" (e.g., Background Noise running alongside multiple Golden Demos).
2.  **Cleanup:** Remove deprecated "Campaigns" functionality and UI.
3.  **Consolidation:** Centralize all configuration settings.
4.  **Frictionless Mapping:** Simplify the creation of mapping profiles directly from the service list to reduce setup friction.
5.  **Admin & RBAC:** (Moved to v2.3.1)

## 1. Cleanup: Remove Campaigns (DONE)
The "Campaigns" feature has been superseded by "Golden Demos" and "Director Mode". We will remove all legacy campaign code.

### Tasks
- [x] **Client:** Delete `client/src/components/CampaignManager.tsx` and `CampaignEditor.tsx`.
- [x] **Client:** Remove "Campaigns" tab from `client/src/components/Header.tsx`.
- [x] **Client:** Remove campaign-related slices from `client/src/store/useStore.ts` (`importedCampaigns`, `campaignConfig`, related actions).
- [x] **Server:** Delete `server/src/routes/campaigns.ts`.
- [x] **Server:** Delete `server/src/services/CampaignExecutor.ts`.
- [x] **Server:** Remove campaign routes from `server/src/index.ts`.

## 2. Consolidate Configuration (DONE)
Ensure all relevant simulation settings are in `ConfigurationForm.tsx`.

### Tasks
- [x] **Review:** Check if `campaignConfig` contained any settings (e.g., `importedChangeRoutingKey`) that need to be migrated to the main `SimulationConfig` for general noise generation.
- [x] **UI:** Ensure `ConfigurationForm` correctly exposes all "Realism & Chaos" settings (Team Failure Probability, etc.).

## 3. Multi-Simulation Architecture (COMPLETE)
Refactor the server to support independent simulation tracks using a "Conductor/Musician" pattern.

### Concept
*   **SimulationSession (The Conductor):** One per User. Manages the central clock (1Hz tick), socket connection, and aggregates state from all tracks.
*   **SimulationTrack (The Musician):** An independent simulation logic unit.
    *   **BackgroundTrack:** Infinite, stochastic, config-driven (Poisson noise, Team Failures).
    *   **ScenarioTrack:** Finite, script-driven (Golden Demos).

### Architecture Changes
- [x] **Server:** Create `SimulationTrack` base class.
- [x] **Server:** Extract `BackgroundTrack` logic from `ServerSimulationEngine`.
- [x] **Server:** Extract `ScenarioTrack` logic from `ServerSimulationEngine`.
- [x] **Server:** Refactor `ServerSimulationEngine.ts` to become `SimulationSession` and support multi-track aggregation.
- [x] **Server:** Update `SimulationManager` to handle `inject_golden_demo_items` by spawning new `ScenarioTrack`s.
- [x] **Server:** Add `stop_track` socket listener to `SimulationManager`.
- [x] **Client:** Update `useServerSimulation` to include `stopTrack` action.
- [x] **Client:** Update `DirectorDashboard` to visualize active tracks with a toggleable slide-out panel (`ActiveTracksPanel`).

## 4. Ease of Mapping (COMPLETE)
Reduce the friction of creating mappings by allowing bulk-creation from the service inventory.

### Features
-   **"Add to Mapping Profile" Action:** In the `ConfigurationForm` (Service List), allow users to select multiple services and click "Add to Profile".
-   **Mapping Modal:** A dialog to select an existing Mapping Profile (or create new) and auto-generate mapping entries for the selected services.
    -   *Default:* Logical Name = Real Service Name.
    -   *Transforms:* Option to apply simple rules (e.g., strip " - Prod" suffix for Logical Name).

### Tasks
- [x] **Client:** Add "Add to Mapping Profile" button to the Services list in `ConfigurationForm`.
- [x] **Client:** Create `AddToProfileModal` component.
- [x] **Client:** Implement `addServicesToProfile` action via `useStore` and `api`.
- [x] **Server:** Ensure `MappingProfileService` supports bulk-adding service mappings.

## 5. Migration Steps
1.  **Refactor Server:** Implement `SimulationSession` and `SimulationTrack` classes.
2.  **Update Client Context:** Modify `SimulationContext` to handle track-based updates.
3.  **Update UI:** Replace global Start/Stop with track-specific controls.
4.  **Cleanup:** Execute deletion of Campaign code.
