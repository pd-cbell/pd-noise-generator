# Validation Checklist v2.4.3

## Local Build
- [ ] `server`: `npm run build`
- [ ] `client`: `npm run build`

## Taxonomy Transition
- [ ] New/edited Golden Demos require `Industry` + `Use Case`
- [ ] Legacy demos without taxonomy show `Needs taxonomy update`
- [ ] Director filters by `Industry` and `Use Case`

## Provider Comparison Harness
- [ ] Run provider harness: `cd server && npm run harness:providers`
- [ ] Review `docs/fixtures/provider-harness/report.json`
- [ ] Confirm both providers produce:
  - [ ] valid narrative + stage structure
  - [ ] expected event/change counts
  - [ ] `service_name` in payload custom details
  - [ ] acceptable payload richness (not overly sparse)

## Repeat-Burst Timeline
- [ ] Event repeat cadence runs concurrently with later scheduled events
- [ ] Inline event controls show `Delay` and `Repeat Count`
- [ ] Overlapping scenarios do not block or reorder timeline execution

## Release Notes
- [ ] Document manual normalization of legacy demos (`Industry` + `Use Case`) in v2.4.3 notes
