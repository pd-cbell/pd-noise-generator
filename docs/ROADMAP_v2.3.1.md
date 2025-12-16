# Roadmap v2.3.1: Admin & RBAC

## Goals
1.  **Admin & RBAC:** Introduce basic Role-Based Access Control and an administration interface to secure the platform.

## 1. Admin & RBAC
Implement basic Role-Based Access Control to manage user permissions and system settings.

### Concepts
-   **Roles:**
    -   `Admin`: Full access to all settings, users, and system configuration.
    -   `Editor`: Can create/edit Golden Demos, Profiles, and run simulations.
    -   `Viewer`: Can view dashboards (Director, Monitor, Presenter) but cannot edit or launch.
-   **User Management:** Simple list of users with role assignment.

### Tasks
- [x] **Database:** Update `User` model in Prisma to include `role` (enum: ADMIN, EDITOR, VIEWER, default: EDITOR).
- [ ] **Server:** Middleware to check roles for sensitive routes (e.g., `POST /api/golden-demos`, `PUT /api/config`).
- [ ] **Client:**
    -   Create `AdminDashboard.tsx` for user management.
    -   Update `AuthContext` to expose user role.
    -   Gate UI elements (Edit buttons, Delete actions) based on role.
    -   Add "Admin" tab to Header (visible only to Admins).

## 2. Migration Steps
1.  **Database Migration:** Add roles to User schema.
2.  **Implement RBAC:** Add middleware and UI gating.