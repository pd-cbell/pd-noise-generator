# Roadmap — v2.5

**Focus:** Deterministic Simulation Architecture + Extensible Background Change Realism

---

## Theme

v2.5 is the next major release focused on foundational simulation architecture improvements that were intentionally deferred from the 2.4.x patch line.

This release prioritizes determinism, testability, and extensibility over shipping broad new UI surface area.

---

## Why v2.5 (Why Major)

The planned work affects core simulation behavior and internal architecture:
- Randomness generation and faker usage
- Track behavior consistency and replayability
- Background change generation pipeline
- Future compatibility for richer event/change templates

Even if external APIs remain mostly stable, the implementation shift is significant enough to treat as a major milestone.

---

## Primary Objectives

### 1. Seeded Randomness Context (Foundation)

Introduce a shared simulation randomness context used by tracks and payload generation.

Goals
- Replace ad hoc `Math.random()` calls in simulation-critical paths
- Support seeded execution per run/track
- Make behavior repeatable within a run and reproducible for debugging

Deliverables
- Seeded RNG utility / context object
- Track-level RNG wiring (starting with background track, then scenario paths as applicable)
- Helper APIs for random int, weighted pick, shuffle/selection
- Logging/debug visibility for active seed(s) where useful

Acceptance Signals
- Same seed + same inputs produce materially identical simulation decisions
- Random helper usage is centralized in simulation paths

---

### 2. Faker Determinism & Rendering Consistency

Refactor faker usage so template rendering and generated payload fields are consistent with seeded execution.

Goals
- Align faker behavior across alerts, changes, and scenario-generated content
- Reduce "surprising" variance during demos and bug reproduction
- Preserve existing template syntax where possible

Deliverables
- Seed-aware faker wrapper/service interface
- Clear separation between deterministic render paths and non-deterministic utility usage (if any remain)
- Regression coverage for common faker token rendering behavior

Notes
- Backward compatibility of `{{faker...}}` tokens is a priority
- Avoid broad template syntax changes in the same release unless necessary

---

### 3. DB-Backed Background Change Adapter/Template System

Replace hardcoded background change payload generation with an extensible adapter/template pipeline.

Scope
- Background noise changes only (initially)
- Preserve existing PagerDuty change event envelope shape
- Include safe fallback when no templates are configured

Deliverables
- Prisma models for:
  - `ChangeAdapter`
  - `ChangeTemplate`
- Seed data for initial adapters/templates
- Adapter/template selection and rendering service
- Legacy fallback path for misconfiguration / empty data

Initial Adapter Targets
- GitHub Actions
- ServiceNow
- Generic CI/CD Pipeline

---

### 4. Simulation Architecture Cleanup (Enable Testing & Extensibility)

Create clearer seams around orchestration, rendering, and transport behavior.

Goals
- Reduce logic concentration in large track/service files
- Improve unit-testability of event generation decisions
- Make future features (template UI, scenario overrides) safer to add

Candidate Refactors
- Extract background change rendering service
- Extract randomization helpers and selection logic
- Improve track lifecycle cancellation patterns for delayed work
- Narrow interfaces between tracks and PagerDuty transport client

---

## Non-Goals (Explicitly Out of Scope)

- Full Golden Demo authoring redesign
- Large frontend visual redesign
- Alert adapter system rewrite (unless required by determinism work)
- Advanced conditional template DSL

---

## Risks & Mitigations

Risk
- Determinism work changes demo feel or perceived realism
Mitigation
- Keep defaults realistic and test with representative demo scenarios before rollout

Risk
- Refactor scope expands into a rewrite
Mitigation
- Ship in slices behind stable interfaces; preserve fallback behavior throughout

Risk
- Template migration complexity slows delivery
Mitigation
- Start background-change-only, keep legacy fallback until parity is proven

---

## Acceptance Criteria

- Seeded RNG context is used in simulation-critical randomness paths
- Faker rendering behavior is deterministic within seeded runs
- Background noise changes can be generated from DB-backed adapters/templates
- Legacy fallback remains functional when templates are absent/misconfigured
- Core simulation behavior remains demo-safe (no stop/restart leakage regressions)

---

## Suggested Delivery Order

1. Seeded RNG context + helper APIs
2. Seed-aware faker wrapper integration
3. Background change adapter/template schema + seeds
4. Background change renderer service + fallback
5. Cleanup pass and regression validation

---

## Prep Work from 2.4.2 (Feeds v2.5)

The 2.4.2 patch line should reduce risk for v2.5 by:
- Fixing track lifecycle cleanup issues
- Tightening release/version hygiene
- Improving logs and diagnostics around simulation behavior
- Closing high-friction user workflow bugs first
