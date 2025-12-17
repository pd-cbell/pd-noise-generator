📜 CHANGELOG

Status: v2.2 and v2.2.1 delivered (bug bash underway).

This document covers changes planned in v2.2 and v2.2.1 for PagerDuty Customer Simulator (a.k.a. pd-noise-generator).

📦 v2.2 — Service Mapping & Runtime Personalization
🎯 Summary

v2.2 introduces Service Mapping Profiles, enabling users to map “logical service names” in Golden Demos to real PagerDuty services + routing keys. This makes Director Mode reusable across multiple customers without modifying authored demos.

🆕 Features
🗂 Mapping Profiles

New Profile System

Service mapping profiles with:

Profile name & description

Global Incident Routing Key

Per-service overrides

Separate service selection for incident vs. change events

Mapping Panel (UI)

Table view showing:

Logical demo service

Incident service dropdown

Incident routing key override

Change service dropdown

“Use incident service for change” toggle

🎛 Director Integration

Profile selector in Director Mode

Choose profile before running a demo

Summary pill showing mapping status

Inline preview of resolved service + key per event

Runtime resolver

Incident/alert events:

Map logical service → chosen PD service

Use either per-service override or global routing key

Change events:

Map logical service → chosen change service

Automatically send via the simulator’s Change Integration Key

Unmapped services warning

Visual cue in Director Mode when a logical service lacks a mapping

⚙ Behavior

Mapping profiles are reusable across multiple Golden Demos

Allows consistent service routing without demo edits

Mapping profile changes reflect live in Director Mode

📦 v2.2.1 — Golden Demo Authoring & Import Enhancements
🎯 Summary

v2.2.1 evolves Golden Demos into the primary authoring surface for scripted scenarios, consolidating legacy Campaign Failure content, adding inline event editing, and supporting Crux imports. It also refactors background noise into a clearly separated configuration.

🆕 Features
🛠 Unified Golden Demo Editing

Inline event editing

Modify event summary, type, timing, service, and payload template

Reordering, enabling/disabling events

Scenario editor

Edit narrative stages (Routine Change, Business Impact, Triage, Resolution)

Link events to those stages

📥 Crux Import Support

Crux importer

Upload/paste Crux JSON

Preview extracted steps/events

Import into a Golden Demo’s event list

🔁 Campaign Failure Import

Legacy “campaign failure” definitions now importable directly into Golden Demos

Translates existing JSON into editable events

🧠 Unified Trigger System

Triggers for:

Golden Demos (per event, per stage, scheduled, webhooks)

Noise Simulation

Replaces fragmented trigger tooling

Single webhook endpoint with profile/scenario context

⚙ Noise Simulation Settings

Legacy Campaign Failure settings moved into a Noise Simulation config area

Noise is separated from scripted Golden Demo scenarios

🏷 Quality of Life & UX Improvements
🎨 Director Mode

Profile persistence

Faster load times with cached service lists

Inline service mapping previews per event

🧪 Validation

Event target resolution validated at save time (Golden Demo Editor)

Warnings raised for unmapped logical service names

Change routing key overrides supported per mapping and per event

📘 Documentation

New sections in README:

Mapping Profiles

Using Director Mode with Profile Overrides

Crux import & Golden Demo authoring

Noise Simulation settings

Example profiles added

📌 Breaking Changes
⚠ Mapping Profiles introduce a required resolution step

Golden Demos now rely on mapping profiles for real PD service names

Attempting to run a demo with unmapped services produces a visible warning and requires mapping selection

⚠ Campaign Failure deprecated

Legacy campaign failure authoring tools are retired in favor of Golden Demo native editing and import

🧭 Migration Notes
From v2.1 → v2.2

Create a mapping profile before running Director Mode for the first time

Directors previously firing demos without mapping now must choose a profile

From v2.1 → v2.2.1

Migrate existing campaign failures into Golden Demos via the new importer

Refactor noise settings into the new “Noise Simulation” configuration UI

🏁 Future Versions
v2.3 (Tentative)

Sharing & Publishing Golden Demos across orgs

Team auto-suggest mapping profiles from PD metadata & fuzzymatching

Multi-profile Director runs (e.g., run same demo against multiple profiles simultaneously)
