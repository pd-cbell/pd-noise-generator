# Roadmap v2.4.1: Patch Release Stabilization

## Status
In progress (local validation done; cloud validation pending).

## Goals
1. Stabilize cloud deployment behavior for auth, sockets, and Monitor metrics.
2. Address high-impact post-release bugs discovered after v2.4.
3. Keep changes minimal and low-risk.

## Scope (Proposed)
- [x] **Agentic change routing key defaults**
  - when Agentic generation creates change events, automatically use the service’s change integration key
  - ensure the exported demo includes the resolved change routing key for each change event
- [x] **Director mapping profile change routing keys**
  - when Director updates a mapping profile for change events, default to the service’s change integration key
- [x] **Agentic event timing bounds**
  - clamp generated event delays to 10–150 seconds between events
- [x] **Narrative generation persistence (cloud)**
  - investigate why full narrative generation output is not being captured in cloud v2.4
  - ensure the generated narrative source is saved and displayed consistently
- [x] **Monitor UI simplification (Golden Track panel)**
  - hide the Golden Track panel on Monitor (keep implementation, remove from display)
- [x] **Scenario event summary validation**
  - investigate Demo Track 400 errors when event `summary` is missing
  - ensure scenario events always include a non-empty summary before send
- [x] **Track run completion**
  - investigate Demo Track runs that remain active long after completion
  - ensure scenario tracks are marked finished when all events are dispatched
- [x] **Golden Demo duplicate name handling**
  - handle unique constraint on (`name`,`createdByUserId`) with a clearer error or auto-suffix
- [x] **Change integration detection**
  - update service integration lookup to include the new generic Change Events integration
  - confirm the PagerDuty API integration type values and align the filter
- [~] **Regression sweep**
  - verify Golden Demo export/import and narrative rendering
  - verify admin impersonation enter/exit behavior

## Notes
- Keep this release scoped to patch-level fixes only.
- Local validation complete; cloud validation pending (regression sweep in cloud).
