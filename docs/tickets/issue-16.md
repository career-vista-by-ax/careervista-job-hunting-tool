T15: Diagnose sparse results before broadening searches

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Explain why a research session produced little and propose controlled adjustments rather than silently relaxing requirements.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Distinguish source failures, narrow query coverage and actual preference conflicts using run and assessment evidence.
- [ ] Show suggested keyword/search changes separately from changes to hard or soft requirements.
- [ ] Require user approval before relaxing requirements and retain the approved change as a profile revision.
- [ ] Identify and reassess relevant saved jobs before recollecting where existing evidence can answer the revised search.
- [ ] Preserve excluded records and explain which prior reasons changed; failed access must not be described as no suitable jobs.
- [ ] Test collection-failure-only, query-limited and genuine-conflict scenarios, including rejected broadening proposals.
