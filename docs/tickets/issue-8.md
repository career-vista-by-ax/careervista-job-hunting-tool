T7: Reconcile duplicates and listing revisions

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Review a vacancy once while retaining its sources, revisions and contradictory information.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Link confident cross-source duplicates to a single Job without removing their Source Observations.
- [ ] Surface uncertain matches for explicit review; allow the user to keep genuinely separate vacancies apart.
- [ ] Retain meaningful listing revisions with capture context and let the user inspect earlier evidence.
- [ ] Show conflicting requirements or compensation rather than silently selecting a source as truth.
- [ ] Repeated identical observations are idempotent; reconciliation preserves assessments and any existing review/application history.
- [ ] Test exact retries, confident duplicates, ambiguous matches, revisions and conflicts through the public interface.
