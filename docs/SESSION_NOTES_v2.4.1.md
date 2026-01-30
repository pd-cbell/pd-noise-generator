# Session Notes - v2.4.1 Patch Stabilization

## Status
Local validation complete; cloud validation pending.

## Scope Summary
- Hardening scenario track behavior (payload normalization, summary enforcement, completion).
- Agentic improvements (change routing keys, delay bounds, narrative persistence + stage fill).
- Mapping/profile UX improvements (type-ahead selection, quick domain config).
- Shared subdomain sim injection improvements (track visibility + control for requester).

## Key Changes
- Scenario payloads normalized to avoid nested payloads; change events now pass links/images.
- Mapping profile applied before scenario start to avoid race with zero-delay items.
- Track run finished state fixed; requester now sees shared track runs in Active Tracks.
- Background noise no longer uses mapping profiles; mapping logs suppressed.
- Change integration detection includes generic change integrations.
- Service fetch chunks team IDs to avoid 414 URI too long errors.
- Quick domain config modal in Director/Mapping Profiles (saves to profile).

## Validation
- Server build: OK
- Client build: OK (non-blocking baseline-browser-mapping warning)

## Follow-Ups
- Impersonation + Director track ownership: track visibility/ownership mismatch (tracked for v2.4.2).
- Cloud validation pending.
