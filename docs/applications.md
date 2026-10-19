# Application history (v1)

Application progress is independent of review decisions, model assessments and listing availability. An agent may record only an explicit user action. Opening a URL never records an event. This module neither fetches application pages nor submits forms nor generates documents.

Public in-process operations are `new Applications(app).record(jobId, input)`, `.timeline(jobId)`, `.links(jobId)` and `.attention(on?)`. The HTTP equivalents are:

- `POST /api/v1/jobs/:id/applications` records an event.
- `GET /api/v1/jobs/:id/applications` returns append-ordered events, latest recorded status and follow-up date.
- `GET /api/v1/jobs/:id/applications/links` returns original source links, without changing history.
- `GET /api/v1/applications/attention?on=2026-10-20` returns applications with a follow-up due on or before the specified local calendar day. Omitting `on` uses the server UTC date; the browser supplies its local date. Accepted, rejected and withdrawn applications are excluded from attention.

Example explicit event:

```json
{
  "operationId": "user-action:application-1",
  "status": "applied",
  "occurredAt": "2026-10-18T02:00:00Z",
  "note": "Submitted through employer website",
  "followUpOn": "2026-10-25",
  "documents": [
    { "kind": "resume", "label": "Resume v3", "reference": "file:///my-documents/resume-v3.pdf" },
    { "kind": "letter", "label": "Letter v1", "reference": "document:letter-v1" }
  ]
}
```

Supported statuses are applied, interview, offer, accepted, rejected, withdrawn and follow_up. Every event requires an operationId and occurrence timestamp. Notes, up to 30 document references, and followUpOn are optional. References are opaque stable identifiers or paths, rendered as text and never read or uploaded. They should identify existing immutable versions; the app does not verify a local document's contents. No document generation is required.

Each new event explicitly supplies its relevant documents and reminder; omission gives an empty document set and clears the current reminder while previous events retain their original values. State reflects the last recorded event, regardless of a backdated occurrence timestamp; the timeline preserves both occurrence and recording timestamps. Corrections are new events, preserving history.

A successful new event returns HTTP 201 `{event,replayed:false}`. An identical operationId retry returns 200 with the original event and `replayed:true`. Changed content or another job with the same operationId returns 409 `idempotency_conflict`, without changing history. Invalid dates, document references, statuses and missing jobs produce actionable validation errors.

The local modal presents the application timeline. Tell the agent about application progress, dates and document references; it uses the explicit-event API only after that instruction. Opening an original/apply link never records an application.

Application events use relational persistence with job-owned cascading deletion, so a future lifecycle module must include them in exports and backups alongside job data. At this implementation point there is no pre-existing export/backup API to extend.
