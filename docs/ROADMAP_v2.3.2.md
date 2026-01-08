# Roadmap v2.3.2: Complete RBAC & Admin UX

**Status:** Complete (local validation done; cloud validation pending)

## Goals
1. **Finish RBAC end-to-end:** ensure roles are enforced server-side and reflected in the client UI consistently.
2. **Admin UX for user roles:** enable Admins to view users and assign roles from the UI safely.
3. **Hardening:** improve defaults, safety rails, and visibility (without adding new product surface area beyond Admin).
4. **Golden Demo sharing + access control:** allow sharing of demos with clear ownership and edit rules.

## Current State (v2.3.2)
- Roles exist in DB (`Role`: ADMIN/EDITOR/VIEWER) with server enforcement and UI gating aligned.
- Admin Dashboard is available with role + agent access management.
- Mapping Profiles are user-scoped; Golden Demo sharing and access rules are enforced.
- Viewer can launch Golden Demos in Director but cannot start background simulation.
- Track lifecycle monitoring exists (server polling + socket updates); UI/guide shipped in v2.4.

## Policy Matrix (v2.3.2)
| Capability | Viewer | Editor | Admin |
| --- | --- | --- | --- |
| View shared Golden Demos | Yes | Yes | Yes |
| Create/edit own Golden Demos | Yes | Yes | Yes |
| Edit shared Golden Demos | No | Yes | Yes |
| Mapping Profiles (own) | Yes | Yes | Yes |
| Start background simulation | No | Yes | Yes |
| Launch Golden Demo in Director | Yes | Yes | Yes |
| Manage users | No | No | Yes |

## 1) Server — RBAC Enforcement
### 1.1 Route coverage audit
- [x] Audit all sensitive routes and confirm required role:
  - write operations: create/update/delete for Golden Demos, Profiles, Mapping Profiles, Taxonomy, Sessions
  - simulation controls (start/stop/inject) as needed
  - `/api/users` must remain ADMIN-only

### 1.2 Policy definition (single source of truth)
- [x] Define a clear policy matrix in docs or constants (role → permissions).
- [x] Ensure middleware errors are consistent (`401` vs `403`) and include minimal safe info.

### 1.3 Safety defaults
- [x] Ensure new users default to EDITOR (or desired default).
- [x] Add a safe “bootstrap admin” path for new deployments:
  - Option A: env var list of admin emails
  - Option B: first user becomes admin (only if DB empty)

### 1.4 Golden Demo access rules
- [x] Add `isShared` flag to Golden Demos.
- [x] VIEWER (Performer): can view shared + own demos; can edit own demos.
- [x] EDITOR (Composer): can view/edit all demos.
- [x] ADMIN (Conductor): full access.

### 1.5 Agent access toggle
- [x] Add per-user `agentEnabled` flag.
- [x] Block `/api/agent/*` when disabled.

## 2) Client — Admin Dashboard & Role Management
### 2.1 Admin UI
- [x] Add/finish `AdminDashboard` user list:
  - show: name/email/avatar/current role/createdAt
  - allow: role dropdown (ADMIN/EDITOR/VIEWER)
  - allow: Agent access toggle (enabled/disabled)
  - disable editing own role (optional safety) or confirm modal
  - show success/error feedback and loading state

### 2.2 UI gating consistency
- [x] Ensure gating is consistent across:
  - Golden Demo create/edit/delete
  - Mapping profile create/edit/delete
  - Taxonomy edits
  - Simulation launch/stop/inject controls
  - Agent Builder access (role + agentEnabled)

### 2.3 UX hardening
- [x] Ensure Viewer can browse but cannot mutate data or launch simulation.
- [x] Ensure Editor can mutate content and run simulation, but cannot manage users.

## 3) Testing / Validation Checklist
- [x] Local: login as ADMIN/EDITOR/VIEWER and verify allowed/blocked actions.
- [x] Golden Demos: verify shared vs. own visibility, edit rights, and shared toggle.
- [x] Agent access: disabled users cannot open Agent UI or call `/api/agent/*`.
- [x] Server: attempt direct API calls as non-admin (expect 403).
- [~] Cloud: validate cookies/CORS + socket auth still work across roles (pending).

## 4) Simulation Hardening
- [x] Skip PagerDuty REST polling when credentials are missing (reduce 401 noise when only triggering Events API).

## Out of Scope for v2.3.2
- Golden Demo lifecycle monitoring UI + presenter “guide” (moved to v2.4, completed).
