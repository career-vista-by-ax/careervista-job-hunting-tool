T20: Export and permanently delete saved data

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Export saved data in documented formats and explicitly remove selected live records.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Provide CSV and JSON export with documented included records, evidence/provenance coverage and format limitations.
- [ ] Exclude credentials and browser-session secrets from exports; do not silently export unrelated private material.
- [ ] Allow explicit permanent deletion of selected records and their associated data while preserving unrelated jobs and history.
- [ ] Explain before deletion that existing backup and export files are separate copies and are not automatically erased.
- [ ] Deleting an excluded job is allowed despite default retention; confirm destructive scope clearly.
- [ ] Test export contents, referential consistency, secret exclusion and targeted deletion through the public interface; later slices extend lifecycle coverage.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Provide an uninstall flow with explicit keep-data or remove-data options, preserving data by default if no deletion choice is made. Stop owned app processes safely and remove owned runtime/dependencies, launchers and skill registrations.
- [ ] Use an installation ownership manifest for any artifacts outside the primary root; never remove shared mise/Node, unrelated skills, other projects, or the normal browser profile. List deliberately retained data and external backup copies.
- [ ] Offer storage-use visibility and scoped clear-cache maintenance with explicit cache/log caps; protect evidence, credentials, persistent sessions and live SQLite state.
- [ ] Verify uninstall/reinstall with retained data, deletion of all selected owned data, idempotent uninstall, and cleanup after failure. Report unreclaimed resources clearly instead of claiming complete removal.
