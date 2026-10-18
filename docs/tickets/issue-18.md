T17: Check availability without losing history

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Verify whether saved listings are still available and show confirmed closure separately from failed checks.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Allow an availability check for a saved listing and preserve last successful verification plus the latest check result.
- [ ] Represent active, confirmed closed and could-not-verify states distinctly.
- [ ] Do not mark a job closed because of an authentication challenge, blocked page, timeout or parsing failure.
- [ ] Keep closed jobs and their evidence searchable while excluding confirmed closed listings from the default active view.
- [ ] Availability changes never overwrite application outcomes or user decisions.
- [ ] Test active, closed, blocked and network-failure cases through controlled source responses and the public interface.
