# Changelog v2.4.2

Status: Local validation in progress; cloud validation pending.

## Highlights
- Director and webhook Golden Demo launches now persist into Session History.
- Session History now shows launch source, launcher identity, and mapping profile used.
- Director cards can copy a webhook launch link using the currently selected mapping profile.
- Agent narrative stage extraction and faker token rendering are more reliable.

## Fixes & Improvements
- Background track delayed follow-up actions are cancelled on stop/restart.
- Scenario track lifecycle status/log transitions are more accurate (`running` / `completed` / `stopped`).
- Impersonation + Director shared-subdomain launch ownership mismatch fixed.
- Director Active Tracks panel now labels owned/shared runs and shows mapping profile badges.
- Director launch/socket errors are surfaced in UI instead of console-only.
- Mapping Profiles page now provides inline validation and save/delete feedback.
- Golden Demo editor can re-extract narrative stages from the stored narrative source (no rebuild required).
- Quick Domain Config modal masks the API token field.
- Golden Demo visibility for `EDITOR` role is limited to owned + shared demos (admin remains unrestricted).
- Version references aligned to `v2.4.2` and patch validation checklist added.

## Known / Pending
- Cloud validation pending.
- Webhook trigger links are convenient but currently unsigned/public; consider signed links in a future hardening pass.
