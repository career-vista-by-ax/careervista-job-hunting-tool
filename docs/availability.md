# Source availability checks

Availability belongs to the listing, independently of application progress, user review and agent fit. In a job modal, open the original source (or ask the browser agent to inspect it), then record the observed result. Opening a link alone does not record a check or application.

`Availability(app)` exposes `record(jobId,input)`, `history(jobId)`, `summaries()` and `activeJobs()`. HTTP operations:

- `POST /api/v1/jobs/:id/availability`: append a check, with identical operationId retries returning the existing check. Conflicting reuse returns409.
- `GET /api/v1/jobs/:id/availability`: complete append-only history, latest check and last successful verification.
- `GET /api/v1/availability`: summaries for all jobs.
- `GET /api/v1/jobs?availability=active`: omit jobs whose last successful check confirmed closure. Ordinary `/jobs` retains all records.

Every input includes `operationId`, a `sourceUrl` matching a saved observation, ISO8601 `checkedAt`, and `result`. Supported results:

- `active` or `confirmed_closed`: require readable captured `text` plus a nonempty verbatim supporting `quote`. This preserves the page evidence used by the agent/user. Quote validation establishes lineage; the reviewer still judges whether the quote establishes availability.
- `could_not_verify`: requires `failureReason` from authentication, verification, blocked, timeout, network or parsing. No raw failure page or credential text is accepted. A failure cannot claim a successful active/closed result.

Last successful verification is the newest successful capture timestamp, rather than the last-arriving request; a delayed old check cannot override a newer closure. A later failed check remains visible but never changes that last confirmed state. With no successful check, status is unknown. Failed access must not be treated as closure.

Closed jobs remain reachable through **Include confirmed closed** above the table and the unfiltered API. Their evidence, assessments and application events remain intact. Check history is persisted in the domain database, included in private backups/JSON exports, and job-owned rows cascade only when explicitly deleting that job. The public acceptance journey checks every failure category, explicit closure, restart, backup recovery and independent application status.
