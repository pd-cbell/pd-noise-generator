# Session Notes (v1.6.1 Complete)

**Date:** 2025-11-26
**Facilitator:** Gemini Agent

## Workstream v1.6.1 – Campaign Editor UX & Precision

### Goals
- Improve the usability of the Campaign Editor for long scenarios (collapsible steps).
- Allow named steps for better readability.
- Support per-step integration keys for Change Events (replacing global overrides).
- Add modern JSON editing conveniences (prettify).

### Completed Tasks
- **Database:**
    - Added `stepName` and `integrationKey` to `CampaignItem` model.
    - Applied migration `add_campaign_item_fields`.
- **Frontend (CampaignEditor):**
    - Implemented collapsible cards for steps.
    - Added "Step Name" input field.
    - Added "Routing Key" input field (conditional: only when type = 'change').
    - Added "Prettify JSON" button to the payload editor.
- **Backend (API/Logic):**
    - Updated `campaigns.ts` (POST/PUT) to persist new fields.
    - Updated `triggerImportedCampaign` (Store) to use the per-step key if present.

---

# Session Notes (v1.6 Complete)

**Date:** 2025-11-26
**Facilitator:** Gemini Agent

## Workstream v1.6 – High Fidelity & Control

### Goals
- Enable full CRUD for Campaigns via UI.
- Simulate Event Compression via "Bursts".
- Provide real-time API throughput visibility.

### Completed Tasks
- **API RPM:** Implemented `apiCallsLast60s` and rolling RPM calculation in `useStore.ts`.
- **Event Bursts:** Implemented burst logic in `triggerIncident` (randomized follow-up events with same `dedup_key`).
- **Campaign Editor:** 
    - Built `CampaignEditor.tsx` and `CampaignManager.tsx`.
    - Added `PUT /api/campaigns/:id` to `server/src/routes/campaigns.ts` to support saving edits.
    - Verified full create/edit/delete flow.
- **UI:** Bumped version to v1.6.

---

# Session Notes (v1.5 Migration)

**Date:** 2025-11-25
**Facilitator:** Gemini Agent

## Workstream v1.5 – Modernization & Monitor Enhancements

### Goals
- Resolve React/JSX stability issues in the Configuration form.
- Enhance the Monitor Dashboard to provide deeper insights (Severity breakdown, API usage).
- Improve simulation control with a true "Pause" state.

### Completed Tasks
- **ConfigurationForm Fix:** Completely rewrote `ConfigurationForm.tsx` to resolve "Adjacent JSX elements" errors and correctly integrate the `SeverityTabs` component.
- **Simulation Control:** 
    - Refactored `useStore` state to split `isRunning` into `isGenerating` (creates new incidents) and `isManaging` (handles lifecycle).
    - Implemented **Pause** functionality: stops generation but continues auto-ack/resolve logic.
    - Updated `Header.tsx` with a contextual button group (Start / Pause / Resume / Stop) and status indicators.
    - Updated `SimulationEngine.ts` and `useSimulation.ts` to respect the new control flags.
- **Metric Enhancements:**
    - Refactored `avgMtta` and `avgMttr` in `useStore` to be maps (`Record<IncidentSeverity | 'global', number>`).
    - Updated `ackIncident` and `resolveIncident` actions to calculate and store these granular metrics.
    - Added **API RPM** tracking: `api.ts` hooks into `useStore` to count requests; `evalTick` calculates rolling rate.
- **Dashboard UI:**
    - Redesigned `MonitorDashboard.tsx` KPI section.
    - Now displays: Active Incidents/Total Events, API RPM/Status, MTTA Breakdown (Global/Warn/Err/Crit), and MTTR Breakdown.

### Next Steps
- **Campaigns:** Fully integrate the `CampaignManager` UI with the new PostgreSQL-backed `importedCampaigns` state.
- **Testing:** Add unit tests for `useStore` logic, particularly the metric calculations and simulation state machine.
- **Cleanup:** Remove legacy `App.jsx` and root-level `server.js` once fully confirmed stable.

---

# Session Notes (v1.3 / v1.3.1 Work In Progress)

**Date:** 2025-11-07  
**Facilitator:** Automation Agent  

## Workstream v1.3 – Auto-Heal, Resume, Change Events

### Goals
- Demonstrate PagerDuty Auto-Pause by auto-healing a slice of warning incidents.
- Keep the Monitor experience transparent (badges, countdowns) so presenters know what is happening.
- Document containerization + deployment path for future hand-offs while landing the change-events/resume experience.

### Key Changes
- Added configurable **Auto-Heal Events** card on the Configure tab (enable toggle, % of warnings, min/max delay).
- Warning incidents can now emit OK events automatically (default 20% between 30–90 seconds). The logic runs even if the simulator is paused.
- Monitor table shows “Auto-heal in …” badges, green row highlighting, and the log records each auto-heal action.
- Added optional “Resume existing incidents” toggle so starting a run syncs triggered/ack’d PagerDuty incidents for the included services (shows “Synced” badge in Monitor).
- README / agent docs cover Docker Compose usage, dynamic routing requirements, and the new auto-heal/resume workflow.
- Added Observability Payload Mix controls plus failure campaign logic so payloads reflect CloudWatch/Datadog/New Relic/Splunk styles and cross-service correlation.

### Verification
- Manual runs forcing warning incidents confirmed OK events hit PagerDuty within configured windows and incidents resolve automatically.
- Monitor table countdowns/log entries validated against actual resolve timestamps.
- Regression pass for Configure/Monitor persistence, Resolve All, and docker-compose startup.
- Resume toggle validated by generating real incidents, restarting the simulator, and observing “Resumed N incidents” logs plus Synced badges.
- Manual verification that campaign settings create related incidents with shared failure IDs and that observability weights influence payload composition.

### Open Questions / Follow-Ups
- Add smoke tests or telemetry around the auto-heal ticker and trend data to catch regressions.
- Consider per-severity auto-heal settings (critical/error) or the ability to disable per service.
- Evaluate whether INFO suppression should become a UI option.

### Next Steps
- Finalize v1.3 release notes + tag once QA passes.
- Explore scripted data seeding + Playwright smoke to cover Monitor filters/trend/auto-heal.

### Change Event Enhancements
- Added `/proxy/change_events` plus integration-aware service loading (`include[]=integrations`) so the browser never needs to expose change integration keys directly.
- Services now capture `changeIntegrations` (types `events_api_v2_inbound_integration`, `change_event_transform_inbound_integration`) and the Configure tab reports coverage per team with an enable/disable toggle.
- Failure campaigns emit 1–3 related change events for covered services (preferring the origin service) so demos show correlated deploy signals alongside incidents.
- Added a quick `curl | jq` snippet (README/Agent Notes) to verify change coverage outside the UI.
- Manual API calls confirmed integrations load with the expected types.
- Ran campaigns with change-enabled services to confirm Monitor log entries (“Sent change event…”) and PagerDuty change events appeared as expected.

## Workstream v1.3.1 – Template Library & UI

### Goals
- Provide a curated template library so presenters can quickly load realistic configurations without re-entering every slider/token.
- Ship a UI browser that lets users pick, clone, and save templates directly inside the Configure tab.
- Maintain parity between stored templates and current schema (auto-heal, campaigns, observers, resume toggles, etc.).

### Key Changes
- Added a Template Library card to the Configure tab (`App.jsx`) with **Save**, **Load**, **Overwrite**, and **Delete** actions plus summary chips (rate, auto-heal, resume, campaigns, change events).
- Templates persist in localStorage (`pdns_template_library_v1`). REST API tokens and routing keys are explicitly excluded from the stored payload.
- Loading a template hydrates Configure state immediately, pre-fills the template form fields, logs an info entry, and marks the template as active.
- `start()` now records the active template name (if any), logs `Simulation started (template: …)`, and the Monitor view surfaces a “Last run template” label alongside the Current Load cards.

### Verification
- Saved multiple templates with varying settings and confirmed they render in the list with appropriate metadata.
- Reloaded the browser to ensure templates survive hard refreshes and the active template badge/inputs hydrate correctly.
- Loaded templates prior to running the simulator; verified the Configure form updated in place and Monitor displayed the new last-run label.
- Exercised Overwrite/Delete actions to ensure metadata refreshes (`updatedAt`, badge) and localStorage reflects the new array ordering.

### Open Questions
- Should template storage remain purely local, or do we sync to disk / PagerDuty via API?
- How do we handle secrets (API tokens, routing keys) within templates—currently they are omitted; if remote sync ships we need an onboarding story.
- What versioning/migration strategy keeps templates compatible as new fields land?

### Next Steps
- Explore import/export (JSON download) so presets can be shared outside a single browser.
- Evaluate whether `/proxy/templates` + authenticated storage is necessary for multi-presenter teams.
- Update release notes + demos once schema stabilizes; add smoke coverage for Save/Load in future automation suites.

### Profiles Support (v1.3.1)

#### Key Changes
- Added a Profiles card to the top of the Configure view with Active Profile picker, New Profile button, and Save / Save As / Delete controls.
- Auto-synced all Configure state (credentials, selections, sliders, filters, template metadata) into profile settings so form edits persist instantly.
- Logged profile usage at run start (`Simulation started (profile: ...)`) for operator clarity.
- Updated docs to describe workflow plus troubleshooting tips.

#### Storage Contract
```jsonc
{
  "version": 1,
  "activeProfileId": "profile_xxx",
  "profiles": [
    {
      "id": "profile_xxx",
      "name": "Customer Warmup",
      "description": "low-noise run",
      "createdAt": 1731012000000,
      "updatedAt": 1731108400000,
      "settings": {
        "pdSubdomain": "",
        "apiToken": "",
        "globalRoutingKey": "",
        "fromEmail": "",
        "selectedTeamIds": [],
        "selectedEPIds": [],
        "includeMap": {},
        "universalResponderCfg": { ... },
        "ratePerMinute": 6,
        "noteProbability": 0.5,
        "responderProbabilityMultiplier": 1,
        "autoResolveMinSec": 90,
        "autoResolveMaxSec": 240,
        "severityWeights": { "info": 0.2, "warning": 0.4, "error": 0.25, "critical": 0.15 },
        "autoHealConfig": { ...DEFAULT_AUTO_HEAL_CONFIG },
        "resumeExistingEnabled": true,
        "sourceMix": { ...DEFAULT_SOURCE_MIX },
        "campaignConfig": { ...DEFAULT_CAMPAIGN_CONFIG },
        "changeEventsEnabled": true,
        "activeTemplateId": null,
        "lastRunTemplateName": null,
        "activePage": "configure",
        "monitorSeverityFilter": "all",
        "monitorAckFilter": "all",
        "monitorMappingFilter": "all",
        "monitorSort": { "key": "startedAt", "direction": "desc" },
        "logFilter": "all",
        "logAutoStick": true
      }
    }
  ]
}
```

#### Migration & CRUD Flow
- On first load the app checks for `pdns_profiles_v1`; missing data triggers a one-time migration that wraps the old `pdns_settings_v7` payload in a `Default Profile`. A dismissible banner informs presenters about the upgrade.
- Profiles auto-sync while editing; **Save** simply updates metadata + resort ordering, while **Save As** clones the current snapshot and activates it immediately.
- **New Profile** seeds sanitized defaults (blank credentials, balanced sliders) so presenters can stage multiple personas within the same browser.
- **Delete** is disabled when only one profile exists; otherwise it removes the current entry, selects the next-most-recent profile, and hydrates Configure with that snapshot.

## Workstream v1.4 – Payload Framework & Campaigns

### Key Changes
- Introduced a payload registry / generator layer so adapters can be registered dynamically (built-ins + imports). The registry powers both the observe mix sliders and campaign overrides.
- Added automatic ingestion of `/templates/payload_import.ms.json` (Crux sample) so external payload definitions become campaign-ready adapters without extra wiring.
- Failure campaigns now rely on PagerDuty to assign dedupe keys (we omit `dedup_key`), capturing the API’s response so the simulator can still reconcile incidents.
- Imported bundles support `event_type = change`; users supply a change routing key and those steps are sent via `/proxy/change_events`.
- Imported campaigns now remain bundled (respecting their timing + change events) and can be triggered on demand via the Campaigns tab.
- Moved all failure campaign controls into a dedicated **Campaigns** tab, including change-event toggles with coverage summaries.
- Campaigns can now target a curated template list (or the entire registry). Manual mode surfaces every adapter with checkboxes; defaults use all available templates.
- New payload registry table exposes adapter metadata (label, vendor, supportsCampaigns) for presenters.

### Verification
- Confirmed registry initializes built-in adapters immediately and appends Crux imports once the JSON loads.
- Exercised Campaigns tab toggles to ensure template selection persists per profile and controls flow through to `startCampaignForService`.
- Triggered runs with and without custom campaign catalogs to validate template overrides take effect during correlated noise.
- Fired the imported campaign manually to verify the JSON-defined cadence and change events execute in order and that PagerDuty returns usable dedupe keys.
- Fired the imported campaign manually to verify the JSON-defined cadence and change events execute in order.
- Verified change-event coverage summary still respects `/proxy/services?include=integrations` data.

### Follow-Ups
- Consider surfacing adapter descriptions/notes in the Configure view for additional context.
- Evaluate exporting/importing adapter catalogs as part of future CLI tooling.

## Upcoming Workstream v1.3.4 – API Throughput Optimization

### Goals
- Bump the incident generator ceiling so presenters can sustain ~500 events/min without starving other flows.
- Smooth bursty traffic from imported campaigns by routing their steps through a shared queue instead of firing every event immediately.
- Reduce REST chatter on Configure (cache `/proxy/services`/`/proxy/teams`, debounce responder/note flows) so API tokens aren’t wasted on duplicate calls.

### Proposed Changes
- Increase the local token bucket (`restLimiterRef`) capacity/refill rate to match the 500 rpm allowance and expose the limit via `.env`.
- Add a lightweight scheduler for imported bundles that meters both alert and change events, honoring delay/interval metadata while keeping per-second call volume consistent.
- Cache profile-specific service/team payloads and only refetch when credentials/team filters change; surface a manual “Refresh data” button for presenters.
- Optional: add a `/proxy/events/bulk` endpoint to absorb browser bursts server-side and centralize retry logic.

### Next Actions
1. Implement the higher-rate token bucket + configurable limit.
2. Introduce request caching + debounced responder/note triggers.
3. Add logging/telemetry so presenters can see when they approach the cap.
4. Ship in v1.3.4 once validated against a 500 rpm demo run.
