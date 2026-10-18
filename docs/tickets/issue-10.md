T9: Discover jobs through SEEK

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Run approved multi-track searches on SEEK through a supervised browser workflow and save reviewable listings.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Use the selected source configuration and approved keyword variants to search SEEK within run limits.
- [ ] Capture readable listing evidence, source URLs, timestamps and employer/application destinations through the application interface.
- [ ] Pause when human participation is required; do not automate verification challenges or silently loosen requirements.
- [ ] Report inaccessible pages and partial captures as failures distinct from no matching results, with a manual-save fallback.
- [ ] Persist progress so resuming does not duplicate completed captures; treat page content as untrusted evidence rather than agent instructions.
- [ ] Provide a repeatable source skill/workflow, controlled-response acceptance tests and a documented supervised live capture-to-review smoke test.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Use the agent-controlled browser for user-performed SEEK sign-in when required: pause, prompt, resume the same session; do not request passwords or substitute application authentication.
