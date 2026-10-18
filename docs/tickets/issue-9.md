T8: Run bounded, resumable research sessions

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Start a research session with approved tracks, selected sources, collection limits and a spending budget, then inspect or resume its progress.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Configure sources and tracks with a suggested limit of 25 new listings; document how duplicate and partial captures count toward limits.
- [ ] Apply AI spending limits before further model work, expose estimated versus known costs, and do not claim exact enforcement where provider cost data is unavailable.
- [ ] Persist checkpoints and distinguish pending work, collected, assessed, excluded, duplicate and failed work in the run view.
- [ ] Pause for user authentication or human verification and resume from saved state without repeated completed mutations.
- [ ] Support stopping or restarting after interruption while retaining partial evidence and actionable errors.
- [ ] Use controlled source responses to test successful runs, pauses, malformed output, exhausted budgets and crash recovery; real source workflows arrive in later tickets.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Provide an explicit waiting-for-user-sign-in/verification state; the agent opens the relevant page, the user completes site login, and the agent resumes the same browser session and checkpoint without collecting credentials.
- [ ] Handle cancellation and expired browser sessions without losing completed work. Test login pause/resume and ensure ordinary cache cleanup cannot delete persistent sessions.
- [ ] Bound app-owned run temp files and logs by documented size/age policies, remove stale artifacts after crashes, and verify repeated/interrupted sessions do not accumulate unbounded disposable data.
