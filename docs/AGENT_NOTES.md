# Agent Notes - v2.3.2 (Admin UX + RBAC)

**Branch:** `v2.3.2`

## Status
v2.3.2 is complete locally with cloud validation pending. Focus is on Admin UX, RBAC enforcement, and safe demo operations.

## Current Platform Snapshot
- **App name:** PagerDuty Customer Sim & Demo Platform (formerly “PagerDuty Noise Simulator”).
- **Multi-simulation runtime:** Server supports multiple concurrent tracks (background noise + Golden Demo scenario tracks) per user session.
- **Mapping Profiles:** Prisma `MappingProfile`/`ServiceMapping` with CRUD API `/api/mapping-profiles`; profiles are user-scoped.
  - Note: client payloads use input types (no `id`/`mappingProfileId` required when creating/updating mappings).
- **Golden Demos:** persisted scenarios with editor (`GoldenDemoEditorV2`), importer, and Director launch experience.
  - Editor UX: required metadata validation (Vertical required; Maturity Level dropdown) and drag-and-drop ordering for events.
- **Agentic Campaign Builder:** creates a Golden Demo via AI and now opens the generated demo in the editor for review/edit/save immediately.
- **Track lifecycle monitoring (server):** Golden Demo runs emit `track_run_*` socket events; server polls incidents by dedup_key for lifecycle updates.
  - UI rendering for tracked incidents was intentionally removed in v2.3.1 and is deferred to v2.4 (tracking remains active under the hood).
- **RBAC:** roles enforced server-side and reflected in the UI; Admin dashboard supports role + agent access management.
- **Viewer behavior:** can launch Golden Demos in Director but cannot start background noise.

## Validation / Release Focus
- Local: verify Admin/Editor/Viewer gating across UI and API.
- Golden Demos: shared vs. own visibility and edit rights.
- Agent access: disabled users blocked from `/api/agent/*`.
- Cloud: cookie/CORS + socket auth validation pending.

## Gotchas / Notes
- Browser console errors from `content_script.js` are typically extension noise (not app errors).
- Track lifecycle UI is deferred to v2.4 by design; do not treat that as a regression.
