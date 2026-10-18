T13: Learn from explicit review feedback

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Record personal save/dismiss decisions and propose reversible preference changes from optional explanations.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Record save/dismiss decisions separately from AI assessments and allow pursuit of a low-rated job.
- [ ] Accept optional reasons and distinguish a one-off decision from a proposed general preference.
- [ ] Show proposed changes and their supporting feedback before applying them to the Preference Profile.
- [ ] Require explicit confirmation before adding a hard exclusion; opening a listing alone does not change preferences.
- [ ] Preserve profile revisions, allow reversal and leave historical assessments attached to their original profile versions.
- [ ] Test proposal acceptance, rejection and reversal, independent decision state, and the hard-exclusion confirmation boundary.
