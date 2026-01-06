CHANGELOG

Status: v2.3.2 complete (cloud validation pending).

This document covers changes delivered in v2.3.1 and v2.3.2 for the PagerDuty Customer Sim & Demo Platform.

v2.3.1 — Admin & RBAC Foundations

- Roles added to users (ADMIN/EDITOR/VIEWER) with initial server wiring and client gating.
- Golden Demo Editor UX improvements (metadata validation + drag-and-drop ordering).
- Agentic Builder opens newly created Golden Demo in the editor.
- Track lifecycle monitoring remains active on the server (UI deferred).

v2.3.2 — Admin UX + RBAC Enforcement

- Admin Dashboard: view users, assign roles, manage agent access.
- RBAC enforced across server routes and UI gating aligned.
- Viewer rules: can launch Golden Demos in Director; cannot start background simulation.
- Golden Demo sharing: viewers can view shared demos but only edit their own.
- Mapping Profiles are user-scoped and not shared.
- First user becomes admin on new deployments (bootstrap).
- PagerDuty REST polling skipped when credentials are missing.
