T18: Complete the daily review workspace

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Review jobs efficiently through saved filters, sortable comparisons and a complete detail panel.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Provide saved filters and sorting for title, company, location/work arrangement, compensation provenance, fit, freshness and user/application status.
- [ ] Show qualifications, preference concerns, confidence, evidence and follow-up questions in a readable detail panel.
- [ ] Provide explicit access to excluded and closed jobs without conflating them with dismissed or rejected applications.
- [ ] Summarise newly collected opportunities and applications needing attention; charts are not required.
- [ ] Keep stored data readable offline and preserve filter state across restart.
- [ ] Exercise main review flows with keyboard-accessible controls, clear empty/error states and a small meaningful set of end-to-end tests.
