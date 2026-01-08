# User Guide

This guide describes how to use the PagerDuty Customer Sim & Demo Platform (v2.4).

## Overview
The platform supports two core workflows:
- **Design time:** author Golden Demos and mapping profiles (optionally with the Agent).
- **Run time:** launch Golden Demos from Director and (for Editors/Admins) run background noise simulation.

## Roles and Access
Current roles (music theme):
- **Conductor (Admin):** manage users + everything Composers can do.
- **Composer (Editor):** create/edit demos and profiles, run simulations.
- **Listener (Viewer):** view shared demos, edit own demos, launch demos in Director (no background simulation).

Note: the UI labels use the music theme, while the system roles remain ADMIN/EDITOR/VIEWER.

## Login
1) Open the app URL.
2) Sign in with Google.
3) If this is a new deployment, the first user becomes ADMIN.

## Load Domain Configuration
Domain configuration connects your PagerDuty account so the app can list teams and services.
1) Open **Configure**.
2) Enter API token, routing key, and from-email.
3) Save to load teams and services.

## Mapping Profiles
Mapping profiles map logical demo services to real PagerDuty services.
1) Go to **Mapping Profiles**.
2) Create a profile with optional global routing key.
3) Add service mappings (logical → incident/change service + routing keys).

Notes:
- Mapping profiles are user-scoped (not shared).
- Profiles are used when launching Golden Demos in Director.

## Golden Demos
Create and edit Golden Demos for scripted scenarios.
1) Go to **Golden Demos**.
2) Create a demo with metadata + narrative.
3) Add or import event items.

Sharing rules:
- Shared demos are view-only for Viewers.
- Editors/Admins can edit all demos.

## Director (Launch Demos)
1) Open **Director**.
2) Pick a mapping profile (optional).
3) Click **Launch** on a demo.

Viewer users can launch demos in Director, but cannot start background noise.

## Background Simulation
Editors/Admins can start background noise from the header.
1) Configure rate, services, and realism settings.
2) Click **Start** in the header.
3) Click **Stop** to end simulation.

## Agent (Optional)
If Agent access is enabled for your account:
1) Open **Agent**.
2) Provide a prompt and generate a proposal.
3) Build a Golden Demo and review it in the editor.

## Admin Dashboard
Admins can manage user roles and agent access:
1) Open **Admin**.
2) Change roles or toggle agent access for users.
3) Self-role changes are disabled for safety.

## Troubleshooting
- **CORS errors on login:** verify `CLIENT_URL` and `VITE_API_URL` match your deployed domain.
- **No services listed:** ensure credentials are saved and valid.
- **Agent blocked:** Admin must enable agent access for the user.

## Cloud Validation
v2.4 is complete with local validation done. Cloud validation is pending.
