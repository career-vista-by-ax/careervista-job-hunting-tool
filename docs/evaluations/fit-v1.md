# Fit-v1 evaluation context

Deterministic contract validation on 2026-10-18 uses `tests/assessments.test.ts`, synthetic teaching jobs, an approved synthetic teaching profile, and `agent: deterministic-test-fixture`, `analysisVersion: 1`, `config.promptVersion: teaching-eval-1`, `temperature: 0`. No real model was called by these fixtures. Provider/model are intentionally absent rather than fabricated. The model-independent public API accepts outputs from any compatible host.

| Case | Decisive saved evidence | Expected review behavior |
| --- | --- | --- |
| Larger school with autonomy | “Teachers choose teaching methods and own classroom programmes.” | Explicit authority supports preference fit regardless of larger organisation size; confidence remains separate |
| Restrictive startup school | “Every teaching-method change requires approval from three directors.” | Effective hard decision-authority conflict excludes but preserves the candidate/evidence; small size provides no autonomy inference |
| Missing pay/work arrangement | No usable affirmative compensation/remote evidence | Unknown, not mismatch; remains promising/investigable rather than excluded for missing values |
| External approval report | “A former employee reports frequent approvals.” | Report remains contextual and inference remains labelled, with a hiring-manager question; no definitive culture verdict |
| Open unknown/inference-only axes | Explicitly unknown work arrangement or model-only match | Cannot receive strong fit even if all submitted axis labels say match |
| Changed assessment under new submission ID | Revised concerns or preferences | Prior label, evidence, profile revision and provenance remain visible; application status stays unchanged |

The public boundary also rejects unsupported quote lineage, nonexistent tracks, non-hard preference conflicts, caller-supplied fit labels and unsupported metadata/config fields, and permits idempotent retries.

## Real model evaluation

Pending integration coordinator validation using Codex as the development host. Record the actual date, available host/model/config identifiers, saved observation/profile/assessment references and observations about unsupported claims, unknowns, preference sensitivity and useful questions. Do not claim these deterministic fixtures demonstrate real-model quality. The owner’s baseline is 1–2 hours per research session; no quantitative time-saving result has yet been measured.
