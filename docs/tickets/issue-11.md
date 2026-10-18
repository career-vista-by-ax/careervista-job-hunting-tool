T10: Discover jobs through LinkedIn

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Run approved multi-track searches on LinkedIn through a supervised browser workflow and save reviewable listings.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Search LinkedIn using approved track keywords and source configuration within the Research Run limits.
- [ ] Save original readable listing content, URLs, capture time and employer/application destinations through the public interface.
- [ ] Let the user control login and verification; pause and resume instead of attempting to bypass challenges.
- [ ] Distinguish failed access, unsupported page content and zero results, retaining partial work and offering manual capture.
- [ ] Resumption must not duplicate completed observations; treat captured page text as evidence, not executable instructions.
- [ ] Provide a repeatable source skill/workflow, controlled-response acceptance tests and a documented supervised live capture-to-review smoke test.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Use the agent-controlled browser for user-performed LinkedIn sign-in when required: pause, prompt, resume the same session; do not request passwords or substitute application authentication.
