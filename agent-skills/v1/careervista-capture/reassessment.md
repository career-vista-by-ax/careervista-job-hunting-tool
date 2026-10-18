# Reassess cached evidence

Read docs/reassessment.md and the assessment contract. User selects saved jobs (including excluded jobs), approved profile revision/track, budget and estimate in Reassess saved jobs. GET /api/v1/reassessments for batches. Never browse/recollect for this operation.

Before each model operation POST /reassessments/:id/jobs/:jobId/input with a stable operationId. Use only returned saved observations, approved profile/effective preferences and immutable prior assessment. Unknowns are not failures. Explain which previous hard-conflict reasons changed and why. Preserve separate review/application decisions. A complete item cannot authorize again; read its saved result.

POST /result with a new operationId, outcome assessed and a fresh AssessmentInput submissionId using the exact observation snapshot and selected profile/track. Record actual agent/model/config metadata only when known. actualCost null means cost unavailable and retains the estimate, never free. If evidence is insufficient or the provider fails, record insufficient_evidence/provider_failure/malformed_output with no assessment and no raw provider errors or credentials. Never force an exclusion to complete the batch. Exact retries preserve the same payload; changed work needs a new batch.
