# Spec #1 review — 19 October 2026

Fixed point: `main` (`3d22cc2ba28e2b1a8e8b076316db7c1164a99ad4`), reviewed with `git diff main...HEAD`. Independent Standards and Spec agents read the originating spec/tickets and module contracts. No repository-specific coding-standard file exists; the architecture contracts and code-review skill's smell heuristics were considered. Tooling-enforced checks were separate.

## Standards

1. Reassessment authorization re-resolved a vacancy's current group and silently lost observations from an earlier saved selection after unlinking. This violated the exact evidence snapshot contract. Fixed by checking the complete persisted evidence scope before authorizing model work and before accepting assessed completion. Scope changes return actionable `scope_conflict`; pending work remains pending, already-authorized work can explicitly settle failure without creating a false fit label. Regression checks cover link/reverse drift before and after authorization, restart, immutable IDs and cost retries.
2. Collected destination reads queried only the canonical job ID, hiding links owned by other grouped source jobs. Fixed by grouped reads over membership while leaving original capture ownership intact. Reversal returns each job's own links again.

## Spec

1. Extraction saved grouped aliases under the canonical ID, so reversing a link left one job without its analysis and another with reasoning quoting a now-unrelated observation. Fixed by retaining the explicitly supplied source job ID. Regression checks cover analysis creation after grouping, replay, reversal and restart.

All three findings were addressed in one implementer branch, `fix/review-group-scope` (`ab827b4`), merged at `43e4ddf`. The merger independently reran the affected public tests and typecheck. The final suite verifies 80 checks. No confirmed scope creep was reported. Native Mac execution limits, external host setup and lack of a comparable personal time-saving measurement remain explicit rather than being counted as verified successes.
