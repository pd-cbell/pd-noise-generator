# Roadmap v2.4.2: Cloud Auth Hardening

## Status
Planning (scope pending confirmation).

## Goals
1. Resolve cloud auth + CORS inconsistencies.
2. Reduce login friction across hosted environments.
3. Keep changes minimal and low-risk.

## Scope (Proposed)
- [ ] **Cloud auth + CORS hardening**
  - validate `CLIENT_URL`/`VITE_API_URL` alignment for hosted domains
  - confirm cookie settings and socket auth work cross-origin

## Notes
- Keep this release scoped to patch-level fixes only.
