# Changelog v2.4.3

Status: Local validation complete; wider beta validation in progress.

## Highlights
- OpenAI is now the default AI provider for Agent proposal/build generation.
- Golden Demo taxonomy moved to `Industry + Use Case` with transitional support for legacy metadata.
- Repeat-burst event behavior restored with concurrent scheduling semantics.
- Generation diagnostics and quality verdicts are now visible in Golden Demo workflows.
- Director Launch Brief now surfaces persona-driven launch context with mapping preview and inline mapping edits.

## Fixes & Improvements
- OpenAI structured-output schema updated for stricter response format validation.
- Agent payload enrichment improved to avoid sparse/flat event payloads.
- Golden Demo editor save validation adjusted for larger generated narrative context.
- Golden Demo detail/library/director surfaces now show quality/readiness status from diagnostics.
- Provider comparison harness added with fixtures and report output for repeatable regression checks.
- PagerDuty region handling updates from PR #5 merged into this patch line.
- Active scenario cards now show scenario-name badges to distinguish concurrent runs.
- Session history persistence restored for Director launches by carrying Golden Demo ID through runtime launch flow.
- Scenario event dispatch now honors event-level configured severity (`info|warning|error|critical`).
- Mapping preview/edit behavior in Director preserves inline mapping actions from prior UX.
- Change-event mapping now requires explicit `changeRoutingKeyOverride`; no fallback to incident/global routing for change events.

## Taxonomy Transition Notes
- `maturityLevel` removed from primary workflows and editing UX.
- New edits/saves use approved dropdown values for `Industry` and `Use Case`.
- Existing demos with legacy metadata remain usable; manual normalization can be performed as needed.

## Known / Deferred
- Composer stage lock/preserve mode remains deferred.
- Full adapter-system event templating remains targeted for v2.5.
