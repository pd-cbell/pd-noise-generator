# Session Notes - v2.3 Bug Bash

## Bugs Identified

### 1. Stop Simulation Fails (Active Tracks Panel)
**Issue:** Clicking "Stop" on an active track in the slide-out panel doesn't seem to stop the simulation track.
**Investigation:**
- Check client-side `stopTrack` emission.
- Check server-side `stop_track` listener in `ServerSimulationEngine.ts`.
- Verify `SimulationSession.stopTrack` logic removes the timer.

### 2. Director Preview: Missing Mapping Controls
**Issue:** "When opening the preview of a demo track in director, I should be able to set mappings in that list."
**Analysis:** `GoldenDemoDetailModal` currently *displays* the resolved mapping but does not offer controls to edit them. The "Ease of Mapping" feature was added to `ConfigurationForm`.
**Plan:**
- Update `GoldenDemoDetailModal` to allow users to **select a mapping profile** directly within the modal (overriding the global selection).
- (Optional/Complex) Allow editing the profile itself? Likely out of scope for a quick fix. Focusing on *selection* or *quick mapping* might be what's needed.
- *Clarification needed:* Does "set mappings" mean "choose which profile to use" or "define the mapping for Service X -> Service Y"?

### 3. Crux Import Error
**Issue:** "Missing logicalServiceName/service_name in payload for item at index 8."
**Analysis:** `importers.ts` fails to find a service name in the payload.
**Plan:**
- Inspect `coerceLogicalService` in `client/src/utils/importers.ts`.
- Add fallbacks or looser validation (e.g., allow user to fill it in later, or default to "Unknown Service").
