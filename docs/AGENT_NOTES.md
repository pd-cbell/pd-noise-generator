# Agent Notes - v2.2.1 (Golden Demo Platform)

**Branch:** `v2.2` (bug bash)

## Status
v2.2.1 delivered (mapping profiles + Golden Demo editor/imports); actively bug bashing.

## Current Platform Snapshot
- **Mapping Profiles (v2.2):** Prisma `MappingProfile`/`ServiceMapping`; CRUD API `/api/mapping-profiles`; Director selector passes `mappingProfileId` to ServerSimulationEngine via socket/webhook. `resolveEventTarget` resolves incident/change targets + routing keys.
- **Routing overrides:** Mapping Profiles now support `changeRoutingKeyOverride` per logical service (priority for change events), plus per-event overrides in Golden Demo editor.
- **Golden Demo Editor (v2.2.1):** `GoldenDemoEditorV2` edits metadata, narrative stages (`configJson.narrative.stages`), and events (`configJson.items`). Enforces/derives `logicalServiceName`; validates JSON payloads. Events support incident/alert/change/note/automation.
- **Imports:** Shared importer (`client/src/utils/importers.ts`) handles Campaign Failure and Crux event_group JSON. Import modal supports paste/upload, append/replace, and base offset adjustment (clamped >= 0). Preserves repeat/interval and payloads.
- **Triggers (Golden Demo):** Public webhook `POST /api/golden-demos/:id/trigger` starts a Golden Demo run server-side. Supports headers/body overrides for `x-pd-routing-key`, `x-pd-change-routing-key`, `mappingProfileId`. Golden Demo detail shows copyable webhook + curl example.
- **Runtime:** Director launches Golden Demos via socket `start_simulation` with `mappingProfileId`. ServerSimulationEngine applies mapping resolution; change events use simulator config/keys; Presenter shows beats/metrics/session history.

## Validation / Bug Bash Focus
- Mapping resolution: unmapped services fall back to logical names + global keys; verify incidents and change events route correctly with selected mapping profile.
- Golden Demo save/load: ensure `logicalServiceName` persists and payload JSON remains valid after edits/imports.
- Import flows: Campaign Failure + Crux parsing (including payload string JSON), base offset adjustments, repeat/interval retained.
- Webhook trigger: starts demo without socket client; routing keys required unless provided via env; mapping profile override respected.

## Gotchas / Notes
- Webhook credentials: uses provided headers/body or env defaults; API token/fromEmail not populated automatically.
- Importer IDs: use `crypto.randomUUID` fallback; no `uuid` dependency.
- Schedule triggers not implemented for Golden Demos (webhook-only).
- Ensure Prisma migrations applied for mapping profiles; changelog tracks planned versions.
