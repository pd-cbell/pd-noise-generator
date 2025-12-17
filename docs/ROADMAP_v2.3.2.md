# Roadmap v2.3.2: Complete RBAC & Admin UX

## Goals
1. **Finish RBAC end-to-end:** ensure roles are enforced server-side and reflected in the client UI consistently.
2. **Admin UX for user roles:** enable Admins to view users and assign roles from the UI safely.
3. **Hardening:** improve defaults, safety rails, and visibility (without adding new product surface area beyond Admin).

## Current State (v2.3.1)
- Roles exist in DB (`Role`: ADMIN/EDITOR/VIEWER).
- Auth loads user + role.
- RBAC helpers exist and are used in some areas, but coverage/consistency needs verification.
- Track lifecycle monitoring exists (server polling + socket updates), but UI/guide is deferred to v2.4.

## 1) Server — RBAC Enforcement
### 1.1 Route coverage audit
- [ ] Audit all sensitive routes and confirm required role:
  - write operations: create/update/delete for Golden Demos, Profiles, Mapping Profiles, Taxonomy, Sessions
  - simulation controls (start/stop/inject) as needed
  - `/api/users` must remain ADMIN-only

### 1.2 Policy definition (single source of truth)
- [ ] Define a clear policy matrix in docs or constants (role → permissions).
- [ ] Ensure middleware errors are consistent (`401` vs `403`) and include minimal safe info.

### 1.3 Safety defaults
- [ ] Ensure new users default to EDITOR (or desired default).
- [ ] Add a safe “bootstrap admin” path for new deployments:
  - Option A: env var list of admin emails
  - Option B: first user becomes admin (only if DB empty)

## 2) Client — Admin Dashboard & Role Management
### 2.1 Admin UI
- [ ] Add/finish `AdminDashboard` user list:
  - show: name/email/avatar/current role/createdAt
  - allow: role dropdown (ADMIN/EDITOR/VIEWER)
  - disable editing own role (optional safety) or confirm modal
  - show success/error feedback and loading state

### 2.2 UI gating consistency
- [ ] Ensure gating is consistent across:
  - Golden Demo create/edit/delete
  - Mapping profile create/edit/delete
  - Taxonomy edits
  - Simulation launch/stop/inject controls

### 2.3 UX hardening
- [ ] Ensure Viewer can browse but cannot mutate data or launch simulation.
- [ ] Ensure Editor can mutate content and run simulation, but cannot manage users.

## 3) Testing / Validation Checklist
- [ ] Local: login as ADMIN/EDITOR/VIEWER and verify allowed/blocked actions.
- [ ] Server: attempt direct API calls as non-admin (expect 403).
- [ ] Cloud: validate cookies/CORS + socket auth still work across roles.

## Out of Scope for v2.3.2
- Golden Demo lifecycle monitoring UI + presenter “guide” (moved to v2.4).
