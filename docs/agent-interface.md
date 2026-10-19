# Evidence-linked analysis interface v1

Any agent or model can use the local HTTP application interface. No proprietary SDK, model key, cloud provider or app account is required. The agent host owns its model/provider settings and any credentials. CareerVista accepts resulting JSON and records optional provenance; it never calls a provider during extraction or sends unrelated notes, resumes or preferences. Change providers/models in the selected host. Do not include API keys or tokens in metadata.

For intake, role expansion, resume strengths or a new search, GET `/api/v1/agent-guide/agent-workflow` first. GET `/api/v1/agent-guide` discovers the installed API guides. Input and reasoning happen in the agent; the webpage presents saved results.

For listing capture, POST `/api/v1/observations` with this capture envelope:

```json
{"ingestionId":"agent:run1:listing1","source":"employer","sourceUrl":"https://example.com/jobs/42","capturedAt":"2026-10-18T01:00:00Z","text":"Teacher. Full readable listing text here.","title":"Teacher","company":"School","context":{"method":"browser-agent"}}
```

`location` is optional. Source URL must be HTTP(S) without embedded credentials, capture time ISO 8601, text at most one million characters and other strings at most 8000 characters. Requests must be JSON under 2 MB. The app accepts loopback requests only, and any Origin header must match the exact app origin. It fetches no source URL. Returns 201 `{job,observation,replayed:false}`; identical ingestionId retry returns existing IDs with 200 and `replayed:true`. Changed content needs a new identifier. GET `/api/v1/jobs/:id` reads the saved observations. Evidence is committed before analysis. Use returned IDs in POST `/api/v1/analyses`:

```json
{
  "submissionId": "agent:run1:analysis1",
  "jobId": "RETURNED_JOB_ID",
  "observationIds": ["RETURNED_OBSERVATION_ID"],
  "metadata": {"agent": "Codex", "analysisVersion": "1"},
  "details": {
    "title": {"status":"known","value":"Teacher","evidence":[{"observationId":"RETURNED_OBSERVATION_ID","quote":"Teacher"}]},
    "company": {"status":"unknown","value":null,"evidence":[]},
    "requirements": {"status":"unknown","value":null,"evidence":[]},
    "benefits": {"status":"unknown","value":null,"evidence":[]},
    "location": {"status":"unknown","value":null,"evidence":[]},
    "workArrangement": {"status":"unknown","value":null,"evidence":[]},
    "employment": {"status":"unknown","value":null,"evidence":[]}
  }
}
```

Metadata optionally includes `model` and `provider` names if the host exposes them. Every known field needs a non-empty value and at least one quote appearing verbatim in an observation belonging to this job and listed in observationIds. Unknown means missing information, not a negative claim. Titles, industries, qualifications and job keywords are unrestricted. Quote validation proves lineage, not that the model's interpretation is correct; review it in the UI.

Returns 201 `{analysis,replayed:false}`; exact retry returns 200 with `replayed:true`. Changed content with an existing submissionId returns 409. Invalid analyses return an actionable 400 and append a safe failure record when jobId/submissionId identify the saved job. Evidence remains unchanged. All requests retain the origin, size and JSON protections documented in architecture.md.

GET `/api/v1/jobs/:id/analyses` returns `{analyses,failures}` in append order. Analyses include immutable `id` and `createdAt`. Corrections use the same schema with a new submissionId, `supersedesId` and non-empty `reason`; the original remains accessible. The detail UI displays the latest submitted analysis, its evidence and all previous versions, as a read-only presentation; submit corrections through the API from the agent. Corrections of factual values must cite saved evidence; add a new observation first if source evidence itself changed.

POST `/api/v1/analysis-failures` with `{jobId,submissionId,code}` where code is `provider_failure` or `malformed_output`. This operation stores only its supported code and a generic actionable message. Never submit raw exception text, provider output or credentials. Failure retries are idempotent. Malformed HTTP JSON cannot identify a job safely and is rejected before recording an attempt.

In-process public boundary: `new ExtractionService(app)`, `submitAnalysis(input)`, `history(jobId)` and `recordFailure(input)`. Register `extractionRoute` in `startServer` for HTTP. Agents always use HTTP rather than SQLite.

# Host setup and removal

The release includes `agent-skills/v1/careervista-capture/`. Explicitly register in a compatible host's skill directory using `node scripts/register-agent-skills.mjs --install --target <directory>`. Use `--uninstall` with the same target to remove only unchanged owned files. A registration manifest in that directory records paths and SHA-256 hashes. Existing conflicting entries are preserved and setup refuses to overwrite them. Uninstall preserves modified files and reports them. No global caches, browser sessions or other skills are touched. Reload the host's skills using its documented mechanism.

Hosts without filesystem skills may consume the packaged SKILL.md and interface.md directly. This setup step is explicit; the core app remains usable without a host. The source registration script is a maintainer utility. End users use the bundled launcher’s `register-skills --host codex` or `--host agents` operation, which uses the included runtime and records installation ownership; see release.md. Browser assistance remains an external, separately installed host capability.

# Codex development validation

Codex desktop with browser-control Chrome extension is the selected development host. Use the existing user-approved Chrome session; host credentials and sessions stay there. Select the desired model/provider in the host's own settings. Supply the running app's loopback origin and invoke the installed capture skill, or give Codex the packaged SKILL.md and interface.md paths. Codex can POST via its allowed local HTTP tooling; browser evidence is captured through its browser tools. Parent evaluation records the actual live source→API→UI checks separately from deterministic nursing/electrician fixtures. Fixtures prove contracts and recoverability, not model judgement or universal site support.

# Explained fit assessments

After extraction and explicit profile/track approval, any host may submit evidence-linked fit interpretations via `POST /api/v1/assessments`. Use the complete [assessment v1 schema and fit rules](assessments.md). Read the approved profile version and effective track preferences; keep qualification fit, working preferences and practical constraints separate. Preserve unknown pay/work-arrangement values, source attribution and questions. Use concrete working-condition evidence rather than company size for authority/culture judgements. Never infer a confirmed hard conflict from an external report or missing information. The application derives labels, retains excluded jobs and immutable history, and leaves the user's decisions/application state untouched.

# Resume proposals

For resume analysis, use only an explicitly user-reviewed payload from `/api/v1/resume-payloads/:id`. Do not request original source text or unrelated personal notes. Follow the [resume proposal schema](resume.md): experience is extractive, possible career tracks need quotes, and aspirations/preferences are supplied by the user during onboarding. Get explicit user authorisation before confirming payload review, creating a user-reviewed draft or approving a profile. Host/model choice stays independent and no app provider key is required.
