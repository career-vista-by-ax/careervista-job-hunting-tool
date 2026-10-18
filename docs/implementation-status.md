# Spec #1 implementation checkpoint

Integration branch: `integration/spec-1`. Draft PR: https://github.com/allenhori/careervista-job-hunting-tool/pull/23. Full spec is **not complete**; keep the PR draft and all implementation tickets open until their acceptance criteria pass.

- #2 listing evidence: merged and public-interface tested; live SEEK/LinkedIn descriptions saved and reviewed through the UI.
- #17 application history: merged and public-interface tested.
- Table/modal owner correction: implemented and desktop/mobile browser checked. Filtering, sorting, Escape close and focus restoration verified. Current full suite: 8 passing tests; typecheck/build pass.
- #3 agent extraction: unfinished work preserved on `ticket/3-agent-capture`; review/finish tests, skill registration and integration before treating it as complete.
- #4 profile/search tracks: unfinished work preserved on `ticket/4-profiles`; review/finish tests and integrate before treating it as complete.
- #20 backup: worktree created, implementation not started.
- All remaining tickets: pending according to `docs/tickets/graph.json`.

Parallel implementers stopped when the collaboration service reported “Your workspace is out of credits.” Their unfinished branches were checkpointed rather than merged. Resume the specified implementer/merger workflow after workspace credits are available. The spec-wide code review and final release validation have not run.

## Accepted scope

Any job seeker/profession, arbitrary user-approved tracks; analytics/data roles are only examples. Model and agent independent, Codex used as development host. User's current research baseline is 1–2 hours/session; no time-saving claim has been measured. Local review is a full-width table; details open in a modal.

## Validation data and external context

The running development preview uses `/tmp/careervista-live-validation` (public captured job descriptions only), port 4318. The owner’s resume/profile has not been imported or approved. Live source capture does not yet establish the full bounded source-skill run or login-pause-resume acceptance.

Scratch pointers retained outside the repository: `/tmp/careervista-context/` contains task graph, release exploration, source observations and evaluation notes. Do not use scratch notes as completion evidence beyond their stated scope. Full source is in the git branches and repository documents.
