T11: Investigate a shortlisted company

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Attach selectively researched company information to a job with sources and uncertainty visible.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Allow the user to request focused investigation of benefits, salary, interview experience or workplace conditions for a selected job.
- [ ] Capture accessible reports from Glassdoor or other selected sources with URL, date, context and company linkage; support manual evidence entry.
- [ ] Distinguish reports, employer claims and inference; do not convert anecdotes or marketing language into verified culture facts.
- [ ] Keep conflicting reports and unknowns visible in the job detail view; preserve originals before summarisation.
- [ ] Pause for required user participation and report unavailable sources without inventing missing information.
- [ ] Test attribution, conflicting reports, incorrect/uncertain company matches and failed access using controlled responses.
