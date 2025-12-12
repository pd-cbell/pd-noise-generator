# Session Notes - v2.2.1 Bug Bash
**Branch:** `v2.2`
**Status:** v2.2.1 complete; bug bashing

## Done in v2.2 / v2.2.1
- **Mapping Profiles (v2.2):**
  - Prisma models `MappingProfile`/`ServiceMapping`, CRUD API `/api/mapping-profiles`.
  - Director selector passes `mappingProfileId` to ServerSimulationEngine (socket + webhook).
  - `resolveEventTarget` maps incident/change targets and routing keys; unmapped falls back to logical service + global keys.
- **Golden Demo Editor (v2.2.1):**
  - `GoldenDemoEditorV2` edits metadata, narrative stages (`configJson.narrative.stages`), and events (`configJson.items`).
  - Event types: incident/alert/change/note/automation; enforces/derives `logicalServiceName`; JSON payload validation.
- **Imports:**
  - Shared importer handles Campaign Failure and Crux event_group JSON.
  - Import modal supports paste + file upload, append/replace, base offset adjustment (clamped >= 0), and keeps repeat/interval.
- **Triggers:**
  - Webhook `POST /api/golden-demos/:id/trigger` starts a Golden Demo run server-side.
  - Supports `x-pd-routing-key`, `x-pd-change-routing-key`, optional `mappingProfileId` header/body. Golden Demo detail shows copyable URL + curl example.
- **Runtime:**
  - Director uses socket `start_simulation` with mappingProfileId; Presenter shows beats/metrics/history.
  - ServerSimulationEngine applies mapping profiles for incidents + change events; change routing key pulled from config/headers/env.
- **Change routing keys:**
  - Mapping profiles support `changeRoutingKeyOverride` per logical service; change events also honor per-event change key overrides. Runtime resolution now prefers event override → mapping override → service change integration → simulator/global.

## Outstanding / Bug Bash Checks
- Verify mapping resolution on incidents/change events (effective service + routing keys) across Director + webhook trigger.
- Validate Golden Demo save/load ensures `logicalServiceName` persists; payload JSON remains valid post-edit/import.
- Import flows: Campaign Failure and Crux payload string parsing; base offset adjustments; repeat/interval respected.
- Webhook trigger without socket client: routing keys present or from env; mapping profile override honored.
- Confirm change events send with mapping change routing key override (no incident-key fallback).
- Schedules for demos: not implemented (webhook-only) — note for future.

## Notes / Gotchas
- Webhook credentials: best-effort; API token/fromEmail not auto-populated.
- Importer IDs use `crypto.randomUUID` fallback; no `uuid` package.
- Ensure Prisma migration for mapping profiles is applied; changelog documents planned versions.
