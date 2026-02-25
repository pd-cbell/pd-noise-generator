# Validation Checklist — v2.4.2

Use this checklist for local and cloud patch validation before release.

## Local Smoke

- [ ] `server`: `npm run build`
- [ ] `client`: `npm run build`
- [ ] App loads and authenticated user reaches dashboard
- [ ] Golden Demo library and Director pages load without console errors

## Director / Track Lifecycle

- [ ] Launch a Golden Demo scenario from Director (no mapping profile)
- [ ] Launch a Golden Demo scenario from Director (with mapping profile)
- [ ] Active Tracks panel shows ownership/source labels (owned/shared)
- [ ] Stop a running scenario track from Active Tracks panel
- [ ] Background track stop/restart does not leak delayed follow-up actions
- [ ] Scenario track transitions to completed status after scheduled events finish

## Impersonation

- [ ] Admin impersonates another user
- [ ] Director launch while impersonating appears in impersonated user context
- [ ] Track ownership/visibility does not attach to another active shared-subdomain user session
- [ ] Stop impersonation and confirm normal Director launch behavior still works

## Mapping Profiles

- [ ] Create new mapping profile with valid mappings
- [ ] Inline validation blocks duplicate logical service mappings
- [ ] Inline validation blocks populated rows without logical service name
- [ ] Save and set profile as Director default
- [ ] Director displays selected profile summary and zero-mapping warning (if applicable)

## Golden Demo Editor

- [ ] Save existing Golden Demo with valid event payloads
- [ ] Invalid event payload JSON shows actionable inline error (event index included)
- [ ] Duplicate-name conflict shows clear save error message

## Cloud / Shared Subdomain Smoke

- [ ] Start a simulation in cloud environment with target subdomain
- [ ] Director launch on shared subdomain works for non-impersonated user
- [ ] Track run updates/finish events continue to stream to UI
- [ ] No unexpected cross-user track ownership in shared scenarios

## Release Hygiene

- [ ] README version matches patch target
- [ ] `client/package.json` and `server/package.json` versions match patch target
- [ ] Changelog / roadmap references updated as needed
