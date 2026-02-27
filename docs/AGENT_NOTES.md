# Agent Notes - v2.4.3 (Taxonomy + Provider Hardening)

**Branch:** `main`

## Status
v2.4.3 patch work is complete. Local validation is complete; broader beta validation is in progress.

## v2.4.3 Focus
- OpenAI provider hardening (proposal/build reliability and output schema compatibility)
- Golden Demo taxonomy transition to `Industry + Use Case`
- Repeat-burst event scheduling with concurrent timeline behavior
- Provider diagnostics, quality surfacing, and regression harness fixtures

## Current Platform Snapshot
- **App name:** PagerDuty Customer Sim & Demo Platform (formerly “PagerDuty Noise Simulator”).
- **Multi-simulation runtime:** Server supports multiple concurrent tracks (background noise + Golden Demo scenario tracks) per user session.
- **Mapping Profiles:** Prisma `MappingProfile`/`ServiceMapping` with CRUD API `/api/mapping-profiles`; profiles are user-scoped.
  - Note: client payloads use input types (no `id`/`mappingProfileId` required when creating/updating mappings).
- **Golden Demos:** persisted scenarios with editor (`GoldenDemoEditorV2`), importer, and Director launch experience.
  - Editor UX: required metadata validation (Vertical required; Maturity Level dropdown) and drag-and-drop ordering for events.
- **Agentic Campaign Builder:** creates a Golden Demo via AI and now opens the generated demo in the editor for review/edit/save immediately.
- **Track lifecycle monitoring (server):** Golden Demo runs emit `track_run_*` socket events; server polls incidents by dedup_key for lifecycle updates.
  - UI rendering for tracked incidents was intentionally removed in v2.3.1 and added back in v2.4.
- **Track Run Monitor:** Monitor now surfaces track run lifecycle with incident/status panels.
- **Presenter Guide:** Narrative stage prompts supplement beats.
- **Editor Domain Config:** Editors can load domain configuration for services, mapping profiles, and agent context.
- **Admin Impersonation:** Admins can impersonate users and exit impersonation.

## Validation / Release Focus
- Director Golden Demo launches populate Session History (launcher + mapping profile + source).
- Webhook-triggered Golden Demo launches create scenario tracks and history rows.
- Editor stage re-extraction from narrative source works for existing demos.
- Quick domain config modal masks API token input.
- Cloud: cookie/CORS + socket auth validation pending.

## Gotchas / Notes
- Browser console errors from `content_script.js` are typically extension noise (not app errors).
