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

Codex desktop performed separate evaluations on 18–19 October 2026 through the same public interface. Host model/provider identifiers were unavailable and omitted. Actual agent/config context, observation/profile/assessment IDs and limitations are recorded in [the validation record](../validation-2026-10-18.md).

The restrictive startup and autonomous larger school cases produced excluded/promising outcomes respectively under explicit synthetic ownership criteria. After an explicitly reviewed hard-to-soft preference proposal, cached Codex reassessment retained the director-approval concern but removed the hard exclusion, appending a promising assessment under profile v4 while retaining the v2 exclusion and saved user decision. Company size did not drive the judgement.

Two real public listings (primary teaching and baking) were extracted with exact saved quotes. Codex retained missing pay as unknown, questioned secondary-trained qualification wording in the primary-role advert, and exposed a full-time header versus alternative two-day roster in the baker advert. Both fit assessments stayed investigate/low confidence because the approved synthetic search profile deliberately supplied no candidate qualifications or concrete preferences. Source descriptions alone cannot establish suitability. These observations are a small development evaluation, not a calibrated quality benchmark. The reported 1–2 hour baseline and 2.61-minute two-listing capture are different workloads; no time-saving percentage is claimed.
