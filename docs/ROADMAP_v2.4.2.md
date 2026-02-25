# Roadmap — v2.4.2

**Focus:** Cleanup, UX Improvements, and Bug Fixes

---

## Theme

v2.4.2 is a stabilization and quality release. The goal is to improve reliability and day-to-day usability after v2.4.1, while avoiding major architectural shifts.

Planned architectural work (seeded randomness, DB-backed background change adapters/templates) is deferred to `v2.5`.

---

## Primary Objectives

### 1. Runtime Reliability Cleanup (Simulation/Tracks)

Reduce inconsistent behavior during start/stop/restart cycles and improve demo operator confidence.

Scope
- Background track lifecycle behavior
- Track stop semantics and delayed work cleanup
- Logging clarity for skipped/failed follow-up events

Deliverables
- Ensure background track stop prevents delayed follow-up emits (timeouts / deferred actions)
- Audit async follow-up work for safe no-op behavior after track stop
- Improve logs for "skipped" vs "failed" change/incident-related actions
- Small refactors only where needed to support reliability

---

### 2. User Workflow Improvements (Director / Editor / Mapping)

Improve common operator and editor flows without changing core demo authoring models.

Candidate Improvements
- Director run visibility and ownership consistency (including impersonation scenarios)
- Better inline validation and error messaging in demo/editor forms
- Mapping profile UX polish (service mapping clarity, defaults, save flows)
- Presenter-facing clarity improvements in monitoring panels and status labels

Principles
- No major UI redesign
- No breaking API changes
- Prioritize friction removal in high-frequency workflows

---

### 3. Bug Fixes and Quality-of-Life

Close known issues and reduce noise before the next major release.

Target Areas
- Impersonation + Director track ownership / visibility mismatch
- Race-condition edge cases around track launches and status updates
- Inconsistent version metadata / release labeling across docs and package manifests
- Minor cleanup of stale comments/TODOs and dead paths discovered during fixes

---

### 4. Release Readiness & Dev Ergonomics (Lightweight)

Tighten release hygiene without introducing a new tooling stack.

Deliverables
- Align version strings where appropriate for the 2.4.x line
- Add or document a basic validation checklist for local/cloud verification
- Optional: add minimal server scripts (`lint` and/or smoke tests) if low-risk and quick

---

## Non-Goals (Explicitly Out of Scope)

- Seeded randomness / deterministic simulation architecture
- DB-backed background change adapter/template system
- Major simulation engine refactors
- Golden Demo schema redesign
- New template authoring UI

These items move to `v2.5`.

---

## Acceptance Criteria

- No known stop/restart leakage of delayed background actions in normal testing
- Impersonation + Director run ownership issue is validated and fixed (or explicitly documented with repro and follow-up)
- At least 2-4 user-facing workflow improvements land with no breaking behavior changes
- Release docs/version labeling are internally consistent for the shipped 2.4.x patch
- v2.5 roadmap is created and captures deferred architecture work

---

## Forward-Looking (v2.5)

Planned next-major focus includes:
- Seeded randomness and deterministic replay behavior
- DB-backed change adapters/templates for realistic background change noise
- Cleaner simulation architecture seams for testability and extensibility

---

## Bugs / Follow-Ups

- Impersonation + Director track ownership: launching a demo track while impersonating appears to attach the run to the original user (track visibility/ownership mismatch). Validate and fix.
- Background track delayed actions may outlive stop/restart boundaries. Validate and harden.

---

## Prioritized Implementation Checklist (Quick Wins First)

### P0 (Do First) - Reliability / Bug Fixes

- [x] Harden `BackgroundTrack` stop behavior so delayed follow-up actions do not emit after stop/restart
- [x] Validate and fix impersonation + Director track ownership/visibility mismatch
- [x] Audit track-start/stop logs and status transitions for misleading states

### P1 - User Improvements (High-Frequency Flows)

- [x] Improve Director Active Tracks visibility labels for owned/shared/impersonated runs
- [x] Surface Director launch/socket errors in UI (not console-only)
- [x] Clarify mapping profile effective behavior and zero-mapping warnings
- [x] Add/clarify inline validation and error feedback in editor forms where failures are currently opaque
- [x] Polish mapping profile save/default flows (reduce confusion around effective routing keys)

### P2 - Cleanup / Release Hygiene

- [x] Align 2.4.x version metadata across README/package manifests/tags as appropriate
- [x] Clean up stale comments/TODOs encountered during fixes
- [x] Document a lightweight local + cloud patch validation checklist
- [x] Cap/prune completed track-run history in client store to reduce UI clutter
- [x] Normalize track lifecycle log messages across Session/Background/Scenario

### P3 - Optional (Time-Boxed)

- [ ] Add minimal server validation script(s) (`lint` and/or smoke checks) if low-risk
- [ ] Small internal refactors that directly reduce bug risk without changing behavior

---

## Suggested Execution Order (Post-P0)

1. Surface Director launch/socket errors in UI (fastest operator impact)
2. Improve Director Active Tracks visibility labels for owned/shared/impersonated runs
3. Clarify mapping profile effective behavior and zero-mapping warnings
4. Align version metadata + add patch validation checklist
5. Cap/prune completed track-run history
