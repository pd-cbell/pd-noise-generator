# Roadmap — v2.4.2

**Focus:** Realistic Background Change Noise + Faker Stability

---

## Theme

v2.4.2 focuses on improving the ambient realism of the simulator by upgrading background change noise from flat, generic payloads to adapter- and template-driven change events, while also addressing known faker determinism and behavior inconsistencies across events and changes.

Golden Demos remain unchanged in this release; this work targets background noise generation only.

---

## Primary Objectives

### 1. Database-Backed Change Adapter System (Background Noise Only)

Introduce a persistent, extensible framework for generating realistic background change events using adapter- and template-based rendering.

Scope
- Applies only to background noise changes
- Does not modify Golden Demo authoring or execution
- Replaces the current flat, hardcoded CI/CD change generator

Deliverables
- Prisma models for:
  - `ChangeAdapter`
  - `ChangeTemplate`
- Seed data for initial adapters and templates
- Adapter selection via weighted randomization
- Template rendering into:
  - `payload.summary`
  - `payload.source`
  - `payload.custom_details`

Initial Adapters
- GitHub Actions
- ServiceNow
- Generic CI/CD Pipeline

Initial Templates (per adapter)
- Routine deploy
- Rollback / hotfix
- Standard / emergency change (ServiceNow)
- Pipeline deploy / configuration update

---

### 2. Realistic Change Payload Rendering

Upgrade background change payloads to look vendor-native while preserving the existing event envelope.

Guaranteed Output Shape
```json
{
  "routing_key": "...",
  "payload": {
    "summary": "...",
    "timestamp": "...",
    "source": "...",
    "custom_details": { }
  }
}
```

Key Behaviors
- Vendor-specific fields (e.g., `change_number`, `run_id`, `commit_sha`)
- Deterministic randomness via seeded generation
- Always produces a non-empty `summary`
- Preserves existing routing key and timestamp logic

---

### 3. Backwards-Compatible Fallback

Ensure simulator stability if templates are missing or misconfigured.

Behavior
- If no enabled change templates are available:
  - Fall back to the legacy flat CI/CD change generator
- No breaking changes to existing simulations

---

## Faker & Randomization Stability Improvements

### 4. Faker Determinism & Consistency Fixes

Address known issues where faker-generated fields behave inconsistently across events and changes.

Problem Areas
- Non-deterministic values across identical simulation runs
- Inconsistent faker usage between alerts and changes
- Over-randomization producing unrealistic noise patterns

Fixes
- Centralize faker and random helpers behind a seeded utility
- Ensure identical inputs produce identical outputs within a run
- Align faker behavior across:
  - Alerts
  - Background changes
  - Scenario-driven noise

Outcome
- More predictable demos
- Easier testing and replay
- Fewer "why did this look different?" moments

---

## Non-Goals (Explicitly Out of Scope)

- Golden Demo change/event authoring updates
- Change template authoring UI
- Alert adapter refactors
- Scenario-level template overrides
- Advanced conditional logic in templates

These items are candidates for future minor releases.

---

## Acceptance Criteria

- Background noise changes are generated from DB-backed templates
- At least 3 adapters and ~9 templates are seeded
- Generated changes appear vendor-realistic
- Existing change envelope shape is preserved
- Faker output is deterministic within a simulation run
- Simulator functions correctly with zero template configuration (fallback enabled)

---

## Forward-Looking (Post–2.4.2)

This release lays the groundwork for:
- Reusing adapters and templates for Golden Demos
- Change template authoring and management UI
- Scenario-specific noise profiles
- Richer change → alert → incident correlation narratives

---

## Bugs / Follow-Ups

- Impersonation + Director track ownership: launching a demo track while impersonating appears to attach the run to the original user (track visibility/ownership mismatch). Validate and fix.
