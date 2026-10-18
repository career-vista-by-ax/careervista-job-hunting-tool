T1: Save and review a listing locally

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Launch the local application on Mac, save a pasted listing and URL, and review its original evidence offline.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Provide a documented Mac launch path, a localhost-only application, and SQLite persistence; record the initial stack choice without implying verified support on other platforms.
- [ ] Save pasted listing text, source URL, capture time, and manually entered basic details through the public application interface; invalid input returns an actionable error.
- [ ] Show saved jobs in a basic table and detail view, including original readable evidence and a link to the source.
- [ ] Restart the application and disconnect from the network; saved jobs remain readable without an agent.
- [ ] Repeated submission with the same ingestion identifier does not create duplicate records; add public-interface tests for persistence, validation and retry.
- [ ] Start reference/dependency-license records and use original implementation; do not modify unrelated projects.

## Blocked by

None (can start immediately).

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Use TypeScript for application code and Node.js for the local runtime; manage development/build versions with mise, verify the latest stable non-prerelease runtime at implementation, and pin exact tested versions plus dependency lockfiles.
- [ ] Establish a documented app-owned root separating application/runtime, persistent data and disposable cache/temp/log areas; launch locally with no application account or sign-in.
- [ ] Keep runtime packaging compatible with self-contained per-OS/architecture archives: normal users must not require preinstalled Node, mise, package managers, Git, compilers or Docker; avoid runtime dependency downloads.
