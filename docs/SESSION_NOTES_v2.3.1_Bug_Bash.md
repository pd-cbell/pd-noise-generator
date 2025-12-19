# Session Notes - v2.3.1 Bug Bash

## Context
- Branch/version: v2.3.1 (Admin & RBAC)
- Environments: local dev; cloud deployment (issues observed, notes TBD)

## Open Bugs / Tasks
- [x] Stop Track from Active Tracks panel does nothing (socket listener registered after room join, never wired for existing sockets).  
  - **Fix:** Moved `stop_track` listener to per-connection (server/src/index.ts); removed adapter timing. Confirmed with Active Tracks panel.
- [x] Director preview: cannot choose mapping profile inside Golden Demo preview modal.  
  - **Status:** Already implemented; doc was stale.
- [x] Crux import: “Missing logicalServiceName/service_name in payload” error.  
  - **Status:** Fixed previously via relaxed fallback; doc was stale.
- [x] Cloud deployment: connection/behavior issues (CORS failures).  
  - **Cause:** `CLIENT_URL` was hardcoded to `localhost` in CFN UserData, causing CORS rejection for public access.
  - **Fix:** Updated `deploy/aws-cfn.yaml` to dynamically fetch public hostname via AWS IMDSv2.
- [x] RBAC enum import crash (`UserRole` undefined) on server start.  
  - **Status:** Fixed (switched to `Role` from Prisma schema; build passes).
- [x] Monitor/socket resilience: start button no-op after auth/socket timing.  
  - **Fix:** Socket status/error surfaced; start blocked until connected; manual sync + reconnect; `request_sim_state` endpoint added.
- [x] Team failure probability too aggressive at low RPM.  
  - **Fix:** Normalize per-minute probability to per-tick (1s) in BackgroundTrack.
- [x] Golden Demo events reorder UX is clunky (arrow buttons).  
  - **Fix:** Implemented drag-and-drop ordering in Golden Demo editor.
- [x] Agentic Campaign Builder: build succeeds but UI doesn’t open the created demo.  
  - **Symptom:** console logs “Agent built Golden Demo…”, but user remains on builder and must manually find it.  
  - **Fix:** App now navigates to Golden Demos and opens the editor modal for the newly created demo.
- [ ] Golden Demo track lifecycle monitoring UI + guide.  
  - **Status:** Server-side lifecycle tracking is implemented; UI rendering has been intentionally removed for now.  
  - **Plan:** Move UI/guide work to v2.4 (design TBD).

## Quick Triage Checklist (per issue)
- Env (local/cloud) + time observed
- Exact error/log snippet
- Steps to reproduce
- Expected vs actual
- Suspected root cause
- Owner / next action / ETA

## Test Checklist
- Local: `npm run build` (server) passes after changes
- Socket: verify Start/Stop simulation and Stop track flows via UI
- Director: mapping selection on preview overrides global mapping
- Import: Crux import succeeds with fallback service naming
- Golden Demo lifecycle: verify `track_run_*` socket events are emitted and state updates continue (UI deferred to v2.4)
- Agent Builder: generate a demo and confirm it opens in the editor immediately
