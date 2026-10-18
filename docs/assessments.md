# Explained fit assessments · version 1

Any compatible agent/model can assess a saved job and POST structured output. CareerVista makes no model call and requires no provider credentials. The host reads approved preferences and saved evidence through the existing API. Send no secrets in evidence or model metadata. Model/provider identity is optional when the host cannot expose it; do not invent it.

An assessment has three independent axes: `qualifications`, `preferences` (working conditions), and `practicalConstraints`. Each axis contains `status: match | concern | unknown`, an explanation, and attributed findings. Evidence confidence (`high | medium | low` plus explanation) is displayed separately and never used as an opaque overall score. A strong fit with medium confidence is possible; it remains an employer claim to verify.

## Public operations

In-process: `new AssessmentsService(app)` offers `submitAssessment(input)`, `history(jobId)`, and `list({label?,excluded?,profileVersion?})`. The app validates and stores a complete immutable assessment, retaining the exact observation IDs, approved profile revision, valid track, agent/model/config provenance and rule version. Historical approved profiles may be assessed even when another revision is active, so the revision is always visible. A draft profile is rejected.

Register `assessmentRoutes` in `startServer`:

| Method/path | Result |
| --- | --- |
| `POST /api/v1/assessments` | 201 `{assessment,replayed:false}`; exact submissionId retry returns 200 with existing IDs and `replayed:true` |
| `GET /api/v1/jobs/:id/assessments` | All immutable assessments in append order, including excluded/historical results |
| `GET /api/v1/assessments` | Latest assessment per assessed job, returned as `{job,assessment}` entries |
| `GET /api/v1/assessments?label=excluded` | Latest assessments matching the label |
| `GET /api/v1/assessments?excluded=true&profileVersion=1` | Latest excluded assessments under the stated profile revision |

`excluded=false` omits currently excluded assessments; the default retains all assessed candidates. Latest means the newest submitted assessment across all profile revisions, not a rewrite of historical results. Use history to inspect past exclusions. Unassessed jobs remain in `/api/v1/jobs`. Assessing a job never changes a review decision, application event, source observation, or profile. Corrections/reassessment use a new submissionId; changed content under an existing identifier returns 409. No PUT/DELETE assessment operation is exposed by this module. Explicit lifecycle deletion is a separate responsibility.

The returned assessment adds `id`, `createdAt`, derived `label` and `rulesVersion: fit-v1`. A caller-supplied label is rejected. Invalid requests give actionable 400 errors without appending trusted results. Normal localhost/origin/JSON limits apply; arrays are capped at 100 entries and text fields at 8000 characters.

## Input schema

A complete conservative example follows. Replace IDs with saved evidence and an approved profile revision/track. This example deliberately reports unknowns; useful assessments should add actual quoted findings rather than copy this result.

```json
{
  "submissionId": "host:run1:job1:assessment1",
  "jobId": "SAVED_JOB_ID",
  "profileVersion": 1,
  "trackId": "APPROVED_TRACK_ID",
  "observationIds": ["SAVED_OBSERVATION_ID"],
  "metadata": {
    "agent": "Compatible agent host",
    "analysisVersion": "1",
    "config": {"promptVersion": "fit-v1"}
  },
  "axes": {
    "qualifications": {"status":"unknown","explanation":"Relevant experience has not been compared yet.","findings":[]},
    "preferences": {"status":"unknown","explanation":"Decision authority requires investigation.","findings":[]},
    "practicalConstraints": {"status":"unknown","explanation":"Compensation and work arrangement remain unconfirmed.","findings":[]}
  },
  "reasonsToPursue": [],
  "concerns": [],
  "questions": [{"dimension":"decisionAuthority","question":"Which decisions can this role make independently?","evidence":[]}],
  "unknowns": [{"dimension":"compensation","explanation":"No usable advertised salary evidence."}],
  "hardConflicts": [],
  "confidence": {"level":"low","explanation":"Too little directly applicable evidence to judge fit."}
}
```

Metadata supports only `agent`, `analysisVersion`, optional `provider`/`model` names, and optional `config` with `promptVersion`, finite numeric `temperature`, and integer `seed`. Unsupported fields, including credentials, are rejected. The caller must never place secrets inside permitted descriptive strings.

A finding is:

```json
{
  "dimension": "decisionAuthority",
  "status": "supports",
  "statement": "The employer explicitly gives teachers discretion over teaching methods.",
  "attribution": "employer_claim",
  "evidence": [{"observationId":"SAVED_OBSERVATION_ID","quote":"Teachers choose teaching methods."}]
}
```

Finding `status` is `supports`, `concern` or `unknown`. Attribution must distinguish `employer_claim`, `external_report`, `model_inference` and `user_confirmed`. Every known supporting/concern finding requires a verbatim quote from a listed observation belonging to the assessed job. Unknown findings use empty evidence and describe a gap rather than an adverse fact. Contextual evidence for a question may be quoted, but questions may also have no quote when investigating missing facts. Reasons to pursue must be supporting findings; concerns must be evidenced concerns. A matching axis needs supporting evidence; a concern axis needs an evidenced concern; an unknown axis cannot assert known support or concern.

A confirmed hard conflict additionally needs an effective hard preference and direct evidence:

```json
{
  "preferenceKey": "decisionAuthority",
  "observedValue": "Three directors must approve every teaching-method change",
  "explanation": "Required discretion over teaching methods conflicts with mandatory approvals.",
  "attribution": "employer_claim",
  "evidence": [{"observationId":"SAVED_OBSERVATION_ID","quote":"Every teaching-method change requires approval from three directors."}]
}
```

Place this object in `hardConflicts` and include an explained concern with the same dimension. The referenced profile must be approved and its track must exist. The **effective** preference must be hard: a shared hard preference overridden to soft or undecided cannot support exclusion. Confirmed conflicts accept only employer claims or user-confirmed facts, not reports or inference. The app verifies lineage and the actual preference kind; it does not prove that a quoted sentence logically entails an agent's interpretation.

## Fit-v1 rules and uncertainty

These initial transparent rules are ordinal decision aids, not calibrated predictions:

1. Any validated confirmed hard conflict → **excluded**, with its reasons retained. It can never be strong.
2. Two or more concern axes → **low_fit**.
3. All three axes match, each has supporting employer/user evidence, no nested unknown/concern finding, no open unknowns and no listed concerns → **strong**.
4. At least one matching axis otherwise → **promising**.
5. All other cases → **investigate**.

Confidence remains independent. Inference-only or external-report-only matches cannot produce strong fit. Missing advertised pay or remote/on-site terms remain unknown, not failures. A confirmed disclosure requirement can be a conflict only when the submitted direct evidence establishes non-disclosure; absence alone must remain investigable rather than being asserted as a negative fact. Preserve the original compensation units and defer structured compensation comparison to its dedicated module.

Company size, startup status, marketing language, and a contextual review do not establish a culture verdict. Agents must investigate concrete authority, ownership, impact, competing priorities and approval conditions separately. Ordinary collaboration, negotiation and people management are not proof of undesirable politics. Never describe a report or model hypothesis as a user-confirmed fact. Include targeted questions for material concerns and unknowns, and avoid definitive workplace judgements from weak sources.

## Review and evaluation

The job modal shows the latest assessment, independent confidence, all three axes, reasons, concerns, unknowns, hard conflict evidence, source links/capture dates, investigation questions and immutable previous versions. Existing review/application controls remain separate. See [evaluation cases](evaluations/fit-v1.md). Deterministic fixtures validate the contract and rules; they do not establish model judgement quality or measured time savings. A real host/model evaluation is recorded separately by the integration coordinator.
