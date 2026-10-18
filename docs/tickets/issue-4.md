T3: Configure preferences and search tracks

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Approve and edit a versioned profile with several career tracks and shared or track-specific preferences.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Create and edit named Search Tracks, approved title/keyword variants, and shared preferences with explicit per-track overrides.
- [ ] Represent hard requirements, soft preferences and undecided values separately for location, work arrangement, compensation, benefits and employment needs.
- [ ] Represent decision authority, end-to-end ownership, impact and approval layers individually; do not equate startup size with autonomy.
- [ ] Distinguish demonstrated experience from aspirations and show the effective preferences for each track before approval.
- [ ] Persist profile revisions and approval state; unapproved suggestions do not silently become active search criteria.
- [ ] Public-interface tests verify version history, override precedence, undecided values and persistence across restart.
