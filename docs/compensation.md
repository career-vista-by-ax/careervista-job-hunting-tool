# Attributed compensation, version 1

Compensation figures are independent immutable records. Advertised pay, external reports, model estimates and user adjustments remain separately labelled in job details. Unknown components remain unknown. Missing figures never imply a pay mismatch. The application performs no annualisation, currency conversion or package/base conversion.

Public operations: `new Compensation(app).record(jobId, input)`, `.history(jobId)`, `.summary(jobId)` and `.summaries()`. HTTP:

- `POST /api/v1/jobs/:id/compensation` appends a figure (201), or returns the existing identical operationId (200). Changed content using the same identifier returns 409.
- `GET /api/v1/jobs/:id/compensation` retrieves all figures and source capture metadata.
- `GET /api/v1/jobs/:id/compensation/summary` retrieves a comparison summary.
- `GET /api/v1/compensation/summaries` retrieves summaries for all jobs, for the comparison table.

Example advertised input:

```json
{
  "operationId": "agent:listing-1:pay",
  "kind": "advertised",
  "attribution": "Employer listing",
  "amount": {
    "min": 55,
    "max": 65,
    "currency": "AUD",
    "period": "hour",
    "basis": "unknown",
    "superannuation": "unknown",
    "contractUnit": "hourly contract"
  },
  "evidence": [{"observationId": "SAVED_OBSERVATION_ID", "quote": "AUD 55–65 per hour."}],
  "uncertainty": "Superannuation treatment not stated."
}
```

All amount keys are required: min/max may be null, currency may be a three-letter uppercase code or null. A single unknown bound means "from" or "up to"; both unknown means "Unknown amount". Period is year, month, week, day, hour, contract or unknown. Basis is base, total_package or unknown. Superannuation is included, excluded, not_applicable or unknown. ContractUnit is free text or null for unknown. The original currency and units are retained, including mixed currencies and contract rates.

Kind is advertised, external_report, model_estimate or user_adjustment. All kinds require attribution. Advertised figures and external reports require a verbatim quote from a saved observation belonging to this job. Source identity, URL and capture date remain inspectable. This verifies quote lineage; the user still judges whether a report applies to the vacancy. Reports may include an uncertainty note describing relevance and confidence.

Model estimates additionally require rationale and uncertainty. Attribution identifies the agent/model/source where known; it never requires a particular model/provider. These figures are explicitly marked as estimates, never employer commitments.

User adjustments require referenceId of an original advertised figure, report or estimate from the same job, plus rationale stating the user's assumptions. Amount fields give the complete adjusted view rather than an implicit percentage calculation. Adjustments cannot overwrite originals or point at another adjustment. Job details provide a labelled adjustment form, original figures, evidence quotes/source links and full history. No automatic conversions happen even if the user changes the currency or period: users must explicitly enter and explain the resulting figures.

Summary selection is the latest advertised figure, otherwise latest external report, otherwise latest estimate. It includes provenance and uncertainty; the latest user adjustment is returned separately with its original reference, never substituted for source facts. No records returns label Unknown and null provenance. Additional figures remain in history, so summaries do not reconcile or erase competing evidence.

Compensation records participate automatically in domain backups, retaining figure IDs, evidence links and adjustment references. The public round-trip test verifies the same visible compensation history after restore. Subsequent export/deletion slices must preserve or explicitly delete this job-owned data with the rest of the domain.
