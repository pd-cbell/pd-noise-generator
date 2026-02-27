# Roadmap — v2.4.3

**Focus:** Provider Hardening (OpenAI) + Golden Demo Taxonomy Cleanup (`Industry` + `Use Case`)

---

## Theme

v2.4.3 is a patch-line release focused on hardening and product cleanup ahead of the larger `v2.5` architecture work.

This release should improve confidence in AI-assisted Golden Demo generation (especially OpenAI support) and simplify demo categorization so narrative generation can make better use of structured intent.

---

## Primary Objectives

### 1. Finalize OpenAI Provider Support (Scenario + Event Generation)

The provider toggle exists and requests can be made, but the OpenAI path has not been sufficiently tested/hardened for reliable day-to-day use.

Goals
- Validate OpenAI end-to-end for proposal/build flows
- Reduce provider-specific parsing/format drift
- Make prompts explicit where OpenAI behavior differs from Gemini
- Improve operator confidence when switching providers

Scope
- Agent proposal generation
- Agent build / event generation
- Provider-specific prompt tuning and output constraints
- Error reporting and fallback behavior (where appropriate)

Deliverables
- Prompt adjustments for OpenAI-specific behavior (format compliance, stage extraction friendliness, payload schema adherence)
- Validation pass across representative demo prompts (different industries/use cases / complexity)
- Clearer errors when provider output is invalid or incomplete
- Documented provider notes / limitations (if any remain)
- Lightweight provider comparison harness (same prompts across `google` and `openai`) for repeatable validation
- Stored regression fixtures/examples for provider output comparisons

---

### 2. Improve Event Generation Pipeline (Prep for `v2.5` Adapter System)

Strengthen the current event generation process so it is easier to adapt to the DB-backed adapter/template system planned for `v2.5`.

Goals
- Make generated events more structured and normalization-friendly
- Reduce provider-specific coupling in the event generation path
- Introduce cleaner seams for adapter/template rendering integration later

Scope (Patch-safe)
- Event generation normalization/validation
- Payload shaping and metadata consistency
- Internal refactors only where they reduce fragility or clarify ownership

Deliverables
- Clear normalization pass for generated events before persistence/use
- Consistent handling of required routing fields and service-name references
- Internal interfaces/utilities that separate:
  - provider output parsing
  - event normalization
  - payload/template rendering preparation
- Backward-compatible behavior for existing Golden Demo configs
- Targeted unit/regression coverage for event parse/normalize/prep behavior

Notes
- This is not the `v2.5` adapter system implementation
- Keep changes incremental and demo-safe

---

### 2b. Restore Event Burst Repeat Scheduling (Concurrent Timeline)

Reintroduce and harden per-event repeat behavior so scenario authors can model recurring/burst signals without blocking subsequent timeline events.

Goals
- Support a first event emit plus repeated emits on a fixed cadence
- Ensure repeats run concurrently with subsequent scheduled events
- Keep authoring controls simple and inline in the event editor

Required Behavior
- Each event supports:
  - `Delay` (offset from scenario start)
  - `Repeat Count` (number of additional emits after the first)
- Repeats for Event A must not delay Event B (or later events) from firing at their own scheduled delays
- Repeat emits should be near-identical to the original event, with optional small payload fluctuations for realism

Example
- Event A: delay `0s`, repeat count `3`, repeat cadence `30s`
- Event B: delay `20s`
- Expected timeline:
  - A at `0s`
  - B at `20s`
  - A repeats at `30s`, `60s`, `90s`

Deliverables
- Inline `Delay` + `Repeat Count` inputs in event editing UI (same row/section)
- Track/runtime scheduling that executes repeats concurrently with timeline progression
- Validation and safeguards against runaway repeat volumes

---

### 3. Golden Demo Taxonomy Change: `Vertical + Maturity` → `Industry + Use Case`

Replace `Maturity` with `Use Case`, introduce dropdown-based `Industry`, and move primary categorization to `Industry + Use Case` while treating legacy `vertical` as transitional/freeform data.

Why
- `Maturity` is low-signal and not meaningfully used in workflow decisions
- `Vertical` is useful context, but existing values are freeform and inconsistent
- `Use Case` is more actionable for demo discovery/selection than `Maturity`
- `Industry` remains valuable, but should be normalized via dropdown options instead of ad hoc labels
- `Use Case` can better inform narrative framing, stage language, and event emphasis

Goals
- Update Golden Demo model/UI/workflows to use `Industry + Use Case`
- Preserve existing demos via a transitional compatibility strategy
- Improve narrative generation prompts by including `industry + useCase` context

Scope
- Golden Demo create/edit forms
- Golden Demo library/detail filtering/display
- Agent generation prompt inputs and stored metadata
- API/server validation for the new field
- Transitional handling of legacy `vertical` values for existing demos

Deliverables
- Remove `maturityLevel` from UI and primary workflows
- Add `industry` / `useCase` dropdowns and use them as the primary taxonomy
- Preserve legacy `vertical` values for existing demos during transition (hidden or read-only)
- `Industry` and `Use Case` as dropdowns (fixed lists for this release)
- Compatibility strategy for existing records (manual normalization for the small existing set)
- Narrative generation updates that consume `industry + useCase`
- `Use Case` display/filter support in Golden Demo Library and Director (at least basic filtering/grouping)
- `Industry` display/filter support in Golden Demo Library and Director (at least basic filtering/grouping)
- "Needs taxonomy update" indicator for demos missing `industry` or `useCase`

Dropdown Options (Confirmed)

Use Case (left 6)
- `Agent Ops`
- `Security Incident Management`
- `Data Ops`
- `DORA Compliance`
- `LLM Ops`
- `Crisis Ops`

Industry (right 6)
- `Financial Services`
- `Public Sector`
- `Travel & Hospitality`
- `Tech & Telco`
- `Retail`
- `Media & Entertainment`

Open Input Required (from you)
- None for dropdown values (confirmed)

---

## Migration / Compatibility Strategy (Proposed)

Keep this patch release boring and safe:

1. Add `useCase` field to Golden Demo schema (nullable at first)
2. Add `industry` field to Golden Demo schema (nullable at first)
3. Remove `maturityLevel` from UI, prompts, filters, and primary API workflows
4. Update UI/API to read/write `industry + useCase`
5. Keep legacy `vertical` values for existing demos as transitional data (hidden or read-only in edit flows, as needed)
6. Require `industry + useCase` when editing/saving a Golden Demo going forward
7. Manually normalize the small set of existing demos to the approved dropdown values
8. Remove legacy schema/data only after the patch flow is validated (or defer cleanup to a later release)

Decision to confirm before implementation
- Patch-safe path (recommended): keep legacy `vertical` data temporarily, enforce `industry + useCase` on edits/new demos, and manually normalize existing demos
- Aggressive path: schema replacement/removal in one pass (higher regression risk)

---

## Non-Goals (Explicitly Out of Scope)

- Seeded randomness / determinism architecture (planned for `v2.5`)
- DB-backed adapter/template implementation (planned for `v2.5`)
- Large UI redesign of Director/Composer
- New provider abstraction layer rewrite

---

## Additional Recommended Enhancements (Patch-Safe)

### A. Generation Diagnostics & Debuggability

Make provider output failures easier to understand without digging through server logs.

Candidate Deliverables
- Persist or expose generation diagnostics summary (provider, parse retries, validation failures, stage extraction success/fail)
- Surface diagnostics in editor/admin debug view where practical
- Include provider + prompt version metadata on generated demos or build results

Why
- Supports OpenAI hardening work and reduces time-to-debug when narrative/event extraction regresses.

### B. Golden Demo Readiness / Validation Indicators

Add a lightweight “ready for launch” signal to improve operator confidence.

Candidate Checks
- Narrative stages present
- Event schema valid
- Required `service_name` routing references present
- No unresolved faker/template placeholders
- Taxonomy fields (`industry`, `useCase`) populated

Candidate Deliverables
- Readiness badge or validation summary in Golden Demo library/detail (and optionally Director)
- Manual review flags for demos with warnings

Why
- Complements the existing “Star / Approved” workflow with a more objective technical readiness check.

### C. Composer Stage Preserve / Lock Mode

Prevent curated narrative stage text from being accidentally overwritten by regeneration or re-extraction flows.

Candidate Deliverables
- Stage-level or global “lock/preserve manual edits” toggle in Composer
- Explicit overwrite confirmation when re-extract/re-generate would replace locked content

Why
- Users are increasingly editing demos manually after generation; this protects polished presenter copy.

### D. Provider Safety Limits / Error UX

Reduce flaky authoring experiences caused by provider response variance.

Candidate Deliverables
- Provider-specific timeout/retry limits and clearer truncation/schema-invalid messaging
- Friendly UI messages for incomplete provider outputs and next-step guidance

Why
- Keeps authoring workflows predictable during OpenAI hardening without a larger provider abstraction rewrite.

---

## Acceptance Criteria

- OpenAI provider can reliably complete proposal + build flows on representative test prompts
- Provider-specific prompt differences are documented and reflected in code (not ad hoc)
- Event generation path has a clearer normalization/prep seam for future adapter work
- Burst/repeat events execute on expected cadence without blocking subsequent scheduled events
- Golden Demo UI/API use `Industry + Use Case` instead of `Vertical + Maturity` in primary workflows
- Existing Golden Demos remain usable after migration/backfill
- Narrative generation quality is at least maintained (ideally improved) with `industry + useCase`
- Provider comparison harness/fixtures exist for repeatable regression checks
- At least one debug/readiness aid lands (generation diagnostics or readiness validation)
- `maturityLevel` is removed from UI and no longer drives prompts/workflows

---

## Prioritized Implementation Checklist (Draft)

### P0 (Foundation / Low-Risk Validation)

- [ ] Inventory and test OpenAI provider behavior across proposal/build flows
- [ ] Capture provider-specific failures (format drift, schema violations, stage parsing misses)
- [ ] Build a lightweight provider comparison harness (same prompt set across `google` and `openai`)
- [ ] Capture baseline fixtures/examples for proposal/build outputs used in regression checks
- [ ] Define patch-safe taxonomy migration strategy and field naming (`industry`, `useCase`)
- [ ] Confirm transitional behavior for legacy `vertical` (hidden vs read-only in edit UI)

### P1 (Provider Hardening)

- [ ] Tune OpenAI prompts for proposal/build outputs (schema compliance and stage extraction reliability)
- [ ] Add/strengthen output validation and error messages for OpenAI paths
- [ ] Add regression test cases or fixtures for provider output normalization/parsing
- [ ] Add provider safety limits/error UX for truncation/invalid-output cases
- [ ] Add generation diagnostics summary (provider, retries, validation/stage extraction outcomes)
- [ ] Add prompt version metadata for generated demos/builds (or equivalent traceability)

### P1 (Taxonomy / UX)

- [ ] Add `industry` + `useCase` fields (schema/API) with patch-safe compatibility
- [ ] Replace `Vertical` + `Maturity` UI with `Industry` + `Use Case` dropdowns in Golden Demo create/edit flows
- [ ] Update Golden Demo library/detail displays and filtering to show `Industry` + `Use Case`
- [ ] Update agent generation inputs/prompts to consume `industry + useCase`
- [ ] Define how `useCase` influences narrative generation (stage emphasis, business framing, incident/change balance)
- [ ] Define how `industry` influences narrative generation (domain language, terminology, examples)
- [ ] Add basic Director surfacing/filtering for `Use Case`
- [ ] Add basic Director surfacing/filtering for `Industry`
- [ ] Remove `maturityLevel` from UI, prompts, filtering, and API write paths
- [ ] Add "Needs taxonomy update" indicator for demos missing `industry` or `useCase`
- [ ] Manually normalize existing demos to approved `Industry` + `Use Case` values (small set)
- [ ] Add Composer stage preserve/lock mode to protect manual edits

### P1 (Simulation Timeline / Event UX)

- [ ] Restore per-event repeat burst behavior with concurrent scheduling semantics
- [ ] Add inline `Delay` + `Repeat Count` controls in event editor rows
- [ ] Ensure repeat cadence is configurable/sane and does not block subsequent events
- [ ] Add regression validation for overlapping events with repeats (A repeats while B/C fire on schedule)

### P2 (Event Generation Prep for v2.5)

- [ ] Refactor event generation into clearer parse/normalize/prep steps (no behavior break)
- [ ] Normalize generated event metadata/required fields before save/render
- [ ] Document seams intended for `v2.5` adapter/template integration
- [ ] Add unit tests for parse/normalize/prep edge cases (service mismatches, missing fields, unresolved placeholders)

### P3 (Docs / Validation)

- [ ] Add `v2.4.3` validation checklist (OpenAI path + taxonomy transition smoke tests)
- [ ] Update changelog/README/user-facing notes for `Industry` / `Use Case` terminology

---

## Test Matrix (Suggested for OpenAI Hardening)

- Provider: `google` / `openai`
- Demo complexity: simple (single-service), medium (2-3 services), complex (multi-service with change events)
- Output checks:
  - valid narrative + narrative stages
  - valid event schema
  - service names match selected service list
  - no unresolved faker/template placeholders in final payloads
  - readiness checks pass (or expected warnings are surfaced clearly)
  - provider diagnostics captured for failed cases

---

## Follow-Up to Start Next

1. Confirm legacy `vertical` handling in edit UI (hidden vs read-only)
2. Manually normalize the small set of existing demos to `Industry` + `Use Case`
3. Run a focused OpenAI provider bug bash and log concrete failures before code changes
