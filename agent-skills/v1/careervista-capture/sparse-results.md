# Diagnose sparse results

Read docs/sparse-results.md. POST /sparse-diagnoses with a stable operationId and runId after a bounded run. Inspect successful/planned searches, sourceFailures, queryLimited and evidenced conflicts separately. Blocked access is never no suitable jobs; empty successful search is never a failed source. Do not weaken hard/soft requirements automatically.

Suggest keyword/search changes through /search-proposals, separately from requirement changes. User reviews acceptance/rejection in Diagnose results. Actual preference changes require saved conflict provenance and a pending requirement proposal through /sparse-diagnoses/:id/requirements. Never fabricate save/dismiss feedback to support a diagnosis. User applies/rejects/reverses through Preference proposals; new/restored hard exclusions require distinct confirmation.

Before another collection, identify relevant saved jobs including excluded jobs. After the user approves a revised profile, create a cached batch with /sparse-diagnoses/:id/reassess and follow reassessment.md. Preserve older reasons and explain which ones changed. Model/insufficient-evidence failures remain unknown, not definite mismatch. No job or application is deleted by diagnosis.
