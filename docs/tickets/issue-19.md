T18: Complete the daily review workspace

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Review jobs efficiently through saved filters, sortable comparisons and a complete job detail modal.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Provide saved filters and sorting for title, company, location/work arrangement, compensation provenance, fit, freshness and user/application status.
- [ ] Show qualifications, preference concerns, confidence, evidence and follow-up questions in a readable job detail modal.
- [ ] Provide explicit access to excluded and closed jobs without conflating them with dismissed or rejected applications.
- [ ] Summarise newly collected opportunities and applications needing attention; charts are not required.
- [ ] Keep stored data readable offline and preserve filter state across restart.
- [ ] Exercise main review flows with keyboard-accessible controls, clear empty/error states and a small meaningful set of end-to-end tests.

### Owner clarification: table and modal review (2026-10-18)

Use a compact full-width table and open job details in a modal dialog. Preserve keyboard closing and focus restoration. No large promotional heading or persistent split-pane detail view.

### Owner clarification: richer comparison table (2026-10-18)

Use JobSync’s documented table and published screenshot as workflow references. Surface application/added dates, employment/work arrangement, status, source and row actions, plus CareerVista-specific compensation with provenance/units, explained fit, independent confidence, material concerns, user decision and availability/freshness. Group secondary labels and allow column visibility/horizontal scrolling so comparisons stay readable. Keep application, user review, agent exclusion and listing availability distinct. Display actual saved values and explicit unknowns; never invent scores, salaries or default onsite values. Details remain in a modal.
