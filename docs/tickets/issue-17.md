T16: Track applications and submitted documents

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Record the user's application progress and which existing documents were used.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Create explicit application events and show a persistent timeline for applied, interview, rejected, withdrawn and other supported outcomes.
- [ ] Keep application state separate from review decisions, AI assessments and listing availability.
- [ ] Open source/apply links without recording a submission; only explicit user action records applying.
- [ ] Associate existing resume/letter versions or stable document references with an application without generating documents.
- [ ] Support follow-up dates and show applications requiring attention.
- [ ] Test event persistence, repeated submissions, document association and the distinction between opening an apply page and applying.
