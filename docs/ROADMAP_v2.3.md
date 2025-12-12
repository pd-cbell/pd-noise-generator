# Roadmap v2.3: Multi-Sim Architecture & Cleanup

## Goals
1.  **Multi-Simulation Architecture:** Enable multiple concurrent, independent simulation "tracks" (e.g., Background Noise running alongside multiple Golden Demos).
2.  **Cleanup:** Remove deprecated "Campaigns" functionality and UI.
3.  **Consolidation:** Centralize all configuration settings.

## 1. Cleanup: Remove Campaigns
The "Campaigns" feature has been superseded by "Golden Demos" and "Director Mode". We will remove all legacy campaign code.

### Tasks
- [ ] **Client:** Delete `client/src/components/CampaignManager.tsx` and `CampaignEditor.tsx`.
- [ ] **Client:** Remove "Campaigns" tab from `client/src/components/Header.tsx`.
- [ ] **Client:** Remove campaign-related slices from `client/src/store/useStore.ts` (`importedCampaigns`, `campaignConfig`, related actions).
- [ ] **Server:** Delete `server/src/routes/campaigns.ts`.
- [ ] **Server:** Delete `server/src/services/CampaignExecutor.ts`.
- [ ] **Server:** Remove campaign routes from `server/src/index.ts`.

## 2. Consolidate Configuration
Ensure all relevant simulation settings are in `ConfigurationForm.tsx`.

### Tasks
- [ ] **Review:** Check if `campaignConfig` contained any settings (e.g., `importedChangeRoutingKey`) that need to be migrated to the main `SimulationConfig` for general noise generation.
- [ ] **UI:** Ensure `ConfigurationForm` correctly exposes all "Realism & Chaos" settings (Team Failure Probability, etc.).

## 3. Multi-Simulation Architecture
Refactor the server to support independent simulation tracks.

### Concept
*   **SimulationSession:** Represents a user's active session. Manages the socket connection and aggregates state.
*   **SimulationTrack:** An independent simulation engine.
    *   **Background Track:** Infinite, stochastic, config-driven (the current "Noise" simulation).
    *   **Scenario Track:** Finite, script-driven (Golden Demos).

### Architecture Changes
*   **Server:** Refactor `SimulationInstance` into `SimulationSession` and `SimulationTrack`.
    *   `SimulationSession` holds a map of `tracks: Map<string, SimulationTrack>`.
    *   `SimulationSession` aggregates `activeIncidents`, `logs`, and `metrics` from all tracks to emit a unified `sim_tick`.
*   **Server:** Add new socket events:
    *   `start_track(trackId: string, config: any)`
    *   `stop_track(trackId: string)`
*   **Client:** Update `DirectorDashboard` to use `start_track` for Golden Demos (instead of `injectGoldenDemo` or `startSimulation`).
*   **Client:** Update `ConfigurationForm` / `Header` to control the "Background Track" specifically.
*   **Client:** Create a "Active Simulations" widget to list running tracks and allow stopping them individually.

## 4. Migration Steps
1.  **Refactor Server:** Implement `SimulationSession` and `SimulationTrack` classes.
2.  **Update Client Context:** Modify `SimulationContext` to handle track-based updates.
3.  **Update UI:** Replace global Start/Stop with track-specific controls.
