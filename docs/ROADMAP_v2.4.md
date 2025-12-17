# Roadmap v2.4: Golden Demo Track Monitor & Presenter Guide

## Goal
Make Golden Demo runs “presenter-friendly” by adding a dedicated monitor/guide experience for per-run incident lifecycle and narrative progress.

## Scope
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
