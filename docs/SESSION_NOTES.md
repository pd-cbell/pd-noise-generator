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
- Added Observability Payload Mix controls plus failure campaign logic so payloads reflect CloudWatch/Datadog/New Relic/Splunk styles and cross-service correlation.
## Verification
- Manual runs forcing warning incidents confirmed OK events hit PagerDuty within configured windows and incidents resolve automatically.
- Monitor table countdowns/log entries validated against actual resolve timestamps.
- Regression pass for Configure/Monitor persistence, Resolve All, and docker-compose startup.
- Resume toggle validated by generating real incidents, restarting the simulator, and observing “Resumed N incidents” logs plus Synced badges.
- Manual verification that campaign settings create related incidents with shared failure IDs and that observability weights influence payload composition.

## Open Questions / Follow-Ups
- Add smoke tests or telemetry around the auto-heal ticker and trend data to catch regressions.
- Consider per-severity auto-heal settings (critical/error) or the ability to disable per service.
- Evaluate whether INFO suppression should become a UI option.

## Next Steps
- Finalize v1.2.0 release notes + tag once QA passes.
- Explore scripted data seeding + Playwright smoke to cover Monitor filters/trend/auto-heal.

## v1.3 – Change Events

### Highlights
- Added `/proxy/change_events` plus integration-aware service loading (`include[]=integrations`) so the browser never needs to expose change integration keys directly.
- Services now capture `changeIntegrations` (types `events_api_v2_inbound_integration`, `change_event_transform_inbound_integration`) and the Configure tab reports coverage per team with an enable/disable toggle.
- Failure campaigns emit 1–3 related change events for covered services (preferring the origin service) so demos show correlated deploy signals alongside incidents.
- Added a quick `curl | jq` snippet (README/Agent Notes) to verify change coverage outside the UI.

### Validation
- Manual API calls confirmed integrations load with the expected types.
- Ran campaigns with change-enabled services to confirm Monitor log entries (“Sent change event…”) and PagerDuty change events appeared as expected.
