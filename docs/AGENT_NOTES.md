# Agent Notes - v2.3.1 (Bug Bash Snapshot)

**Branch:** `v2.3.1`

## Status
v2.3.1 is in bug bash / hardening mode. Focus is on stability, RBAC foundations, and Golden Demo UX polish (no major new product surface area).

## Current Platform Snapshot
- **App name:** PagerDuty Customer Sim & Demo Platform (formerly “PagerDuty Noise Simulator”).
- **Multi-simulation runtime:** Server supports multiple concurrent tracks (background noise + Golden Demo scenario tracks) per user session.
- **Mapping Profiles:** Prisma `MappingProfile`/`ServiceMapping` with CRUD API `/api/mapping-profiles`; director can choose mapping profiles for Golden Demo runs.
  - Note: client payloads use input types (no `id`/`mappingProfileId` required when creating/updating mappings).
- **Golden Demos:** persisted scenarios with editor (`GoldenDemoEditorV2`), importer, and Director launch experience.
  - Editor UX: required metadata validation (Vertical required; Maturity Level dropdown) and drag-and-drop ordering for events.
- **Agentic Campaign Builder:** creates a Golden Demo via AI and now opens the generated demo in the editor for review/edit/save immediately.
- **Track lifecycle monitoring (server):** Golden Demo runs emit `track_run_*` socket events; server polls incidents by dedup_key for lifecycle updates.
  - UI rendering for tracked incidents was intentionally removed in v2.3.1 and is deferred to v2.4 (tracking remains active under the hood).
- **RBAC:** roles exist (`Role`: ADMIN/EDITOR/VIEWER) with basic client gating + server wiring; full Admin UX and enforcement hardening planned for v2.3.2.

## Validation / Bug Bash Focus
- Socket reliability: start/stop simulation, stop tracks, and manual state sync.
- Golden Demo: create/edit/import flows, event ordering, and Director preview/mapping selection.
- Agent Builder: build → immediately open editor for the created Golden Demo.
- RBAC: ensure viewer/editor/admin gating is consistent and server routes enforce expected permissions.

## Gotchas / Notes
- Browser console errors from `content_script.js` are typically extension noise (not app errors).
- Track lifecycle UI is not present in v2.3.1 by design; do not treat that as a regression.
