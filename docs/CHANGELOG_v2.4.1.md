# Changelog v2.4.1

Status: Local validation complete; cloud validation pending.

## Highlights
- Agentic change events now default to service change integration keys and clamp delays to 10–150s.
- Narrative generation persists full source, TLDR in overall narrative, and stages auto-filled.
- Scenario events normalized (summary enforced, payload flattened, change links/images passthrough).
- Track runs now finish correctly and are visible to the initiating user in shared subdomain sims.
- Mapping profile change routing keys default from service integrations.

## Fixes & Improvements
- Prevent background noise from using mapping profiles; suppress mapping logs for background.
- Scenario mapping profile applied before track start (prevents race with zero-delay events).
- Unique name constraint now returns a clear 409 conflict on Golden Demo create/update.
- Change integration detection includes generic Change Events integration type.
- Service fetch now chunks team IDs to avoid 414 URI too long errors.
- Director and Mapping Profiles: inline domain config modal (client-side) with “save to profile.”
- Director and Mapping Profiles: type-ahead service mapping inputs (supports free text).

## Known / Pending
- Cloud validation pending.
