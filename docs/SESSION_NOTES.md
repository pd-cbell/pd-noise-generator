# Session Notes (v1.1.0 Release)

**Date:** 2025-11-06  
**Facilitator:** Automation Agent  

## Goals
- Improve observability of the simulator while incidents are running.
- Reduce noise from INFO-level events and streamline clean-up tasks.
- Document Monitor workflows for future agents.

## Key Changes
- Introduced Configure/Monitor tab layout with persistent view state.
- Added Monitor dashboard upgrades: 15-minute trend chart, sortable/filterable incident table, log filters, and incident detail drawer.
- Added “Resolve All” bulk control and suppressed INFO incidents from active tracking to cut incident ID mapping load.
- Added Dockerfile + docker-compose for easy local/infra deployments.
- Updated README and internal docs to reflect the Monitor experience and new release.
- Tagged `v1.1.0`.

## Verification
- Manual simulation run validating trend chart updates every 30s and Monitor filters/sorts.
- Confirmed “Resolve All” clears active records and logging reflects batch action.
- Verified INFO incidents still reach PagerDuty but no longer create local active records.

## Open Questions / Follow-Ups
- Automate smoke coverage for Monitor trend data and filters (see Agent Notes).
- Monitor whether INFO suppression needs user toggles vs permanent behavior.
- Explore packaging the monitor chart as a reusable component for other demos.

## Next Steps
- Gather feedback from demo sessions on the new Monitor layout.
- Scope automated checks or telemetry for the trend chart sampling loop.
