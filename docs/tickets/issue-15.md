T14: Reassess saved jobs after preferences change

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Evaluate already-saved evidence against a new preference revision without needing another collection session.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Let the user select existing jobs, including excluded jobs, for reassessment under an approved profile version.
- [ ] Create traceable new assessments without overwriting earlier reasoning, evidence references or model/configuration context.
- [ ] Restore jobs to the eligible view when the new preferences warrant it while retaining the earlier exclusion reason.
- [ ] Keep personal decisions and application history unchanged by reassessment.
- [ ] Report jobs whose evidence is insufficient and model failures without treating them as definite mismatches.
- [ ] Test changed hard requirements, restored eligibility, failed analysis and historical inspection without network recollection.
