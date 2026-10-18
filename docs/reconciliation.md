# Vacancy groups and evidence-preserving reconciliation

A saved source job remains immutable storage ownership for its observations and historical decisions. Explicitly confirmed duplicate links form a vacancy group with a deterministic canonical identity (oldest saved record, then ID). `CareerVistaApp.listJobs()` returns each group once and combines source names. `getJob(canonicalOrAliasId)` resolves that group, includes all original observations and `memberJobIds`. Observation IDs, ingestion identifiers, source job IDs, URLs, original text and capture dates remain unchanged. The identity/title shown for the group is a display identity, not a conclusion that its source is correct.

No heuristic automatically merges. `new Reconciliation(app).candidates(jobId)` offers high-confidence signals for identical source URLs or normalized listing text, and review-only suggestions for matching title/company. Same URL with changed text is a possible revision; generic reused URLs still require human checking. Different capture text is preserved in full. Same title/company alone cannot establish vacancy identity.

Public operations:

- `.decide({operationId,leftJobId,rightJobId,decision:'link'|'keep_separate',reason,userConfirmed:true})`
- `.reverse({operationId,eventId,reason,userConfirmed:true})`
- `.detail(jobId)` returns canonical/member IDs, original source job fields, source-linked histories, revision/difference warnings and append-only decision history.
- `.history(jobId?)` reads explicit reconciliation events.

HTTP registers `reconciliationRoutes` and exposes POST `/api/v1/reconciliation/decisions`, POST `/api/v1/reconciliation/reverse`, GET `/api/v1/jobs/:id/reconciliation`, GET `/api/v1/jobs/:id/reconciliation/candidates`, and GET `/api/v1/reconciliation/summaries`. Identical operationId retries return the original event (200); a new event returns 201. Changed retries return 409. Explicit confirmation and non-empty reasons are required. Keep-separate constraints block transitive grouping through a third job. Only the latest effective pair decision may be reversed. Reversal removes that pair's current constraint; other active links may still connect a group, and older decisions are retained for inspection rather than silently reactivated.

Application, compensation, extraction, assessment, company-research and availability history operations aggregate linked members by default, retaining the original job IDs inside events/analyses. Internal source-history views may pass `sourceOnly=true` as the second argument to inspect one original source job. No records are reassigned or overwritten, so reversal naturally restores separate original histories. New events saved after grouping belong to the job ID explicitly supplied; they stay attached to that source after reversal. When original fields, listing text or compensation values differ, detail reports the variation and keeps all evidence; it does not label one source authoritative or convert compensation units.

Full JSON exports/backups automatically include both source records and reconciliation membership/history. CSV presents each canonical vacancy once with all original source links; full history remains a JSON capability. Permanent deletion of a canonical vacancy expands to all its member source jobs, and preview lists this complete scope. All member evidence and reconciliation links/events are removed through foreign keys while unrelated vacancies remain. Reversal is the appropriate operation when the user wants to separate vacancies rather than delete their data.

## Composition instructions

This ticket intentionally leaves main.ts and client.ts untouched for the integration owner:

1. Import `reconciliationRoutes` from `./reconciliation.ts` and add to `startServer(...routes)`.
2. Import `showReconciliation` from `./reconciliation-ui.ts` in public/client.ts; call `await showReconciliation(detail, job.id)` inside the job modal, preferably before original evidence. Optional third callback refreshes the workspace after a decision; default reloads the page to reflect canonical rows.
3. The separate UI presents candidates, explicit link/keep-separate buttons, reasons/reversal history, source variants, every original captured text and per-member application/assessment/compensation/availability histories with full explanation inspection.
4. The comparison workspace may call GET `/api/v1/reconciliation/summaries` to display alias counts, source-job IDs and differences. Existing domain histories already aggregate group members, so an alias's applied event, assessment or compensation does not disappear from canonical summaries. Future review/feedback modules should use `vacancyIdentity` for grouped reads and preserve original source ownership for reversible histories.

Automated acceptance covers retry stability, confirmed/ambiguous candidates, explicit separation, revision text, transitive conflicts, reversal across restart, grouped application history, all-source API responses, backup recovery and deletion without resurrected aliases.

Grouped availability remains source-sensitive: a confirmed active source keeps the vacancy active; closure requires every retained distinct source URL to have a successful closed check. A single closed source plus an unverified linked source remains unknown. Per-source checks and captured dates remain available so contradictory/stale source claims can be reviewed.
