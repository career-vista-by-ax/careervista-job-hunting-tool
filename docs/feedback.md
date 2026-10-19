# Explicit review feedback and reversible preference proposals

Save, dismiss and unreviewed are personal review decisions. They are independent of an agent's fit assessment, listing availability and actual application progress. You can save a low-fit or excluded candidate without changing its assessment. Opening a listing never records a review or changes a profile. Reasons are optional and belong to that one decision until an explicit general preference proposal is reviewed.

The agent records a decision and optional explanation only when the user requests it in the conversation. A nonempty explanation can support a pending general-preference proposal; show its scope, before/after setting, base profile revision, rationale and supporting decisions before applying it. Individual decisions remain separate from general preferences. The jobs table displays the saved decision. No provider key is required by the app.

Apply a change through the API only after the user explicitly reviews the supporting feedback and proposed generalisation. Adding a hard preference requires a second explicit hard-exclusion confirmation. Accepting creates and activates a new approved profile revision, preserving the prior revision and profile ancestry. A rejection records its history without changing preferences. Individual dismissals never silently harden filters.

**Reverse this change** restores only the affected shared preference or track override, creating another approved revision. Unrelated later preference edits are preserved. If the affected key was changed again, reversal rejects with a conflict instead of overwriting the user's newer choice. Reinstating a hard requirement—including removal of an override that reveals an inherited hard requirement—requires explicit hard-exclusion confirmation. Earlier assessments remain linked to their original profile revisions and are not recomputed by feedback actions.

## Public application boundary

`new FeedbackService(app)`:

- `recordDecision(jobId,{operationId,decision,reason?})` returns `{event,replayed}`. Decisions are `saved`, `dismissed` or `unreviewed`; reason defaults to empty text.
- `history(jobId,sourceOnly=false)` returns `{jobId,decision,events}`; the latest explicit decision is current, with `unreviewed` as the default.
- `propose(input)` returns `{proposal,replayed}`. Requires 1–100 distinct supporting decision IDs, at least one nonempty reason, and a valid changed preference based on an approved profile revision.
- `getProposal(id)` and `proposals(status?)` expose the original proposal, supporting feedback and append-only acceptance/rejection/reversal events.
- `accept`, `reject` and `reverse` take `(proposalId,{operationId,confirmed:true,confirmHardExclusion?})` and return `{proposal,profile,replayed}`. Rejection has no profile result.

Proposal input:

```json
{
  "submissionId":"agent:feedback-proposal1",
  "baseProfileVersion":1,
  "feedbackIds":["SAVED_REVIEW_DECISION_ID"],
  "change":{"key":"workArrangement","kind":"soft","value":"Hybrid"},
  "explanation":"The user described a commute preference; ask whether it should apply beyond this job."
}
```

Optional `trackId` scopes the change to that track's explicit overrides; omission changes shared preferences. The standard profile preference validation applies, including explicit undecided/null values. A proposal cannot be a no-op. Pending proposals can be based on an older approved profile, but acceptance requires that base revision still be active; a changed active profile requires a fresh reviewed proposal. A save/dismiss without an explanation does not support an inferred general preference.

Operations use unique identifiers. Identical retries return existing records/results; changed content with the same identifier returns 409. Actions are state-checked: pending may accept/reject; accepted may reverse; rejected/reversed cannot silently reopen. New ideas need new proposals. Inputs are allowlisted and bounded. Original profile approval and proposal/event insertion are atomic via SAVEPOINT-compatible profile operations. Failed validation or conflict leaves the active profile unchanged.

## HTTP interface

Register `feedbackRoutes` with the server composition root:

| Method/path | Operation |
| --- | --- |
| `GET /api/v1/jobs/:id/reviews` | Current personal decision and complete history |
| `POST /api/v1/jobs/:id/reviews` | Append explicit decision; 201, or 200 for an identical retry |
| `GET /api/v1/preference-proposals?status=pending` | Proposals; optional pending/accepted/rejected/reversed status |
| `POST /api/v1/preference-proposals` | Create pending proposal; 201, or 200 for retry |
| `GET /api/v1/preference-proposals/:id` | Proposal with feedback and event history |
| `POST /api/v1/preference-proposals/:id/accept` | Explicitly apply; separate hard-exclusion confirmation when needed |
| `POST /api/v1/preference-proposals/:id/reject` | Explicitly reject |
| `POST /api/v1/preference-proposals/:id/reverse` | Explicitly reverse without overwriting later changes |

Local single-user trust applies. A compatible agent must obtain the user's explicit instruction before asserting action confirmation or hard-exclusion confirmation. Explanations are local personal data; ordinary collection/assessment permission does not authorise sharing unrelated review notes with cloud providers.

## Presentation

The jobs table and modal show saved decisions; all feedback/proposal mutations use the API from the agent conversation. Historical browser-form modules remain source references and are not mounted by the browsing client.

## Lifecycle and validation

Private backups and full JSON exports include decisions, proposals, support relationships and event history. Existing public round-trip tests verify recovery. Explicit job deletion removes its decision history and dependent proposals/events; the user-approved profile revision remains an independent preference snapshot. Separate backup/export files remain separate private copies. No credentials or browser sessions are added to the domain database.

Synthetic teaching fixtures verify decision independence, pursuit of low-rated candidates, proposal acceptance/rejection/reversal, hard-confirmation boundaries (including inherited exclusions), immutable history, idempotency, backup recovery and explicit deletion. UI/model evaluation remains an integration validation step.

Vacancy-group history aggregates all member decisions by default and retains each event’s original source job ID. Passing `sourceOnly=true` shows one source, and splitting a group restores its separate review state without moving rows. Agent actions should target the canonical job; the public API preserves an explicitly supplied source ID, consistent with other domain histories. Reconciliation detail includes per-member review histories.
