# Roadmap v2.4: Golden Demo Track Monitor & Presenter Guide

## Goal
Make Golden Demo runs “presenter-friendly” by adding a dedicated monitor/guide experience for per-run incident lifecycle and narrative progress.

## Scope
- [ ] **Load Domain Config for Editors**
  - allow Editor users to enter API token + routing key to load teams/services
  - reuse loaded domain data for Agent generation and Mapping Profile creation
- [ ] **Role Label Theme Update**
  - update role labels to the music-theme naming in UI and docs
  - Admin → Conductor, Editor → Composer, Viewer → Listener
- [ ] **Admin Impersonation**
  - allow Admins to impersonate another user for debugging or demo setup
- [ ] **Golden Demo Export**
  - export Golden Demos (metadata + items + narrative) to JSON for sharing/backup
- [ ] **Narrative Persistence + Stage Auto-Fill**
  - store the full generated narrative used for event generation
  - show the full narrative in Golden Demo detail/editor
  - populate Narrative Stages from the generated narrative
- [ ] **Editor-Owned Simulation Sessions**
  - allow Editors to start/stop background simulation for their own domain only
  - grant Editors access to Monitor scoped to their own session
  - ensure start/stop controls only affect the current user session
  - prevent starting multiple sims for the same PD subdomain (best-effort check)
- [ ] **Golden Demo Track Monitor UI**
  - render per-run lifecycle from `track_run_*` events (server-side tracking already exists)
  - support selecting runs and showing timelines
  - clear separation from background simulation monitoring
- [ ] **Presenter Guide**
  - lightweight “what to say / what to show” prompts aligned to beats/events
  - integrate with existing Golden Demo beats when present

## Notes
- Server-side lifecycle tracking is already implemented (polling via dedup_key correlation).
- UI was intentionally removed in v2.3.1 pending design (tracking continues under the hood).
- Dedup behavior supports intelligent alert grouping:
  - seed event uses a deterministic dedup_key for lifecycle anchoring
  - repeat triggers use unique dedup_keys per send and are not polled
