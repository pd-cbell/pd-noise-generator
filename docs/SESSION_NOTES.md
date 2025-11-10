# Session Notes (v1.2.0 Work In Progress)

**Date:** 2025-11-07  
**Facilitator:** Automation Agent  

## Goals
- Demonstrate PagerDuty Auto-Pause by auto-healing a slice of warning incidents.
- Keep the Monitor experience transparent (badges, countdowns) so presenters know what is happening.
- Document containerization + deployment path for future hand-offs.

## Key Changes
- Added configurable **Auto-Heal Events** card on the Configure tab (enable toggle, % of warnings, min/max delay).
- Warning incidents can now emit OK events automatically (default 20% between 30–90 seconds). The logic runs even if the simulator is paused.
- Monitor table shows “Auto-heal in …” badges, green row highlighting, and the log records each auto-heal action.
- Added optional “Resume existing incidents” toggle so starting a run syncs triggered/ack’d PagerDuty incidents for the included services (shows “Synced” badge in Monitor).
- README / agent docs cover Docker Compose usage, dynamic routing requirements, and the new auto-heal/resume workflow.
## Verification
- Manual runs forcing warning incidents confirmed OK events hit PagerDuty within configured windows and incidents resolve automatically.
- Monitor table countdowns/log entries validated against actual resolve timestamps.
- Regression pass for Configure/Monitor persistence, Resolve All, and docker-compose startup.
- Resume toggle validated by generating real incidents, restarting the simulator, and observing “Resumed N incidents” logs plus Synced badges.

## Open Questions / Follow-Ups
- Add smoke tests or telemetry around the auto-heal ticker and trend data to catch regressions.
- Consider per-severity auto-heal settings (critical/error) or the ability to disable per service.
- Evaluate whether INFO suppression should become a UI option.

## Next Steps
- Finalize v1.2.0 release notes + tag once QA passes.
- Explore scripted data seeding + Playwright smoke to cover Monitor filters/trend/auto-heal.
