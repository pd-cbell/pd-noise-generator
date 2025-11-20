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
