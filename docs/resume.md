# Resume import and explicit onboarding

Resume intake happens in the agent conversation. The host's document tools read user-supplied PDF, Word or text; no document conversion form is exposed by CareerVista. Before requesting an upload, strongly recommend removing personal identifiers and using Word (.docx) or TXT so those identifiers do not reach the agent. Remove any remaining personal identifiers before writing to CareerVista; save only the sanitised parsed base through this text API for later reuse; confirm useful factual competitive strengths and save the authorised subset in the profile's `demonstratedExperience`. The user may search without a CV; once a CV is supplied for intake, persist the sanitised parsed base rather than keeping it only in the conversation. See [agent workflow](agent-workflow.md).

This optional lineage API accepts readable text (format `txt` or `paste`, up to one million characters) extracted by the host. PDF/Word binaries are not accepted by this text endpoint. Invalid/unsupported input is rejected without partial ingestion. The API performs no document parsing or model call.

The API stores exactly the submitted source in the local domain database and private backups. Agent-led intake must therefore sanitise the source and its label before import; payload preview redaction happens after storage and cannot protect an unredacted source. This is an agent instruction, not a new automatic API filter. Previously saved sources are not changed by this policy. Build job searches from role/skill terms and approved city/region preferences, never candidate identifiers or identifiable CV excerpts. Import creates a new immutable source version. It does not create or activate a profile. The import HTTP response omits original source text. The app never reads or sends unrelated notes, credentials or browser sessions.

## Review the analysis payload

The default `contacts-v1` redaction removes email addresses, phone-like numbers, URLs, street-address lines, explicit contact/name/date-of-birth fields and likely first-line names, including mixed name/role headers. Employment year ranges and ISO dates are preserved. Redaction is conservative and may remove useful headers or miss unusual contact formats; the preview explicitly asks you to inspect every line and edit the exact payload. This preview is the content to be analysed, rather than an assurance that arbitrary documents contain no personal information.

Present the exact redacted text in the conversation and obtain explicit review confirmation before saving a reviewed payload. Each confirmation saves an immutable reviewed payload. The agent-facing endpoint returns only that reviewed version, its IDs, source version, redaction version and review time. It does not include the original source, source label, unrelated notes or optional onboarding answers. Edited payloads can deliberately restore text removed by the default; confirmation authorises that exact content. No payload is automatically sent to a provider. Private backups retain submitted source text, including contact details if an unredacted source was previously imported, and must be stored privately.

Any compatible agent/model can read the reviewed payload and submit grounded suggestions. Provider settings and optional credentials belong to the host. When unavailable, leave provider/model identity absent rather than inventing it. Ask the agent to quote demonstrated experience verbatim; the app rejects a generated achievement whose text is not an exact quote in the reviewed payload. Suggested career tracks/title variants/keywords need supporting quotes and a rationale, but remain possible directions, not proven qualifications or inferred aspirations.

The agent presents proposals in the conversation. The user corrects facts, supplies aspirations, chooses tracks and confirms hard/soft/undecided preferences. A linked profile draft is a separate explicit action and remains unapproved; present its effective settings before approval. Source → reviewed payload → proposal → profile lineage remains stored. Later edits use `basedOnVersion` ancestry without automatic approval.

Agent failures append safe codes and generic recovery guidance. Sources, reviewed payloads and earlier suggestions remain intact. Retrying an identical import/proposal/review identifier returns the existing operation; changed content needs a new identifier. Revised sources are separate imports, and revised payloads/proposals remain inspectable. Resume-profile draft creation and its source link are atomic through the profile service's SAVEPOINT transaction convention.

## Public API

In-process boundary: `new ResumeService(app)` provides `importResume`, `listResumes`, `getResume` (local original source), `payloadPreview`, `reviewPayload`, `agentPayload`, `submitProposal`, `getProposal`, `history`, `recordFailure`, and `createProfileDraft`. All persisted records participate in private backup/restore. No credential or browser-session storage is added.

| Method/path | Operation |
| --- | --- |
| `POST /api/v1/resumes` | `{importId,label,format:"txt"|"paste",text}`; returns metadata, never original text |
| `GET /api/v1/resumes` | Saved source metadata/version list |
| `GET /api/v1/resumes/:id/preview` | Default-redacted text and review notice; not yet approved for analysis |
| `POST /api/v1/resumes/:id/payloads` | `{operationId,text,confirmed:true}`; saves exact reviewed payload |
| `GET /api/v1/resume-payloads/:id` | Reviewed agent payload; source IDs cannot be used in place of a reviewed payload ID |
| `GET /api/v1/resumes/:id/history` | Reviewed payloads, immutable proposals, safe failures and linked profile versions/descendants |
| `POST /api/v1/resume-proposals` | Grounded agent suggestion schema below |
| `GET /api/v1/resume-proposals/:id` | Retrieve a proposal |
| `POST /api/v1/resume-failures` | `{resumeId,operationId,code}`; provider_failure, malformed_output or invalid_proposal; no raw output/secrets |
| `POST /api/v1/resume-profile-drafts` | `{operationId,proposalId,confirmedReview:true,profile:ProfileInput}`; user-reviewed draft, never automatic activation |

Proposal example:

```json
{
  "submissionId":"host:resume1:proposal1",
  "resumeId":"SOURCE_ID",
  "payloadId":"REVIEWED_PAYLOAD_ID",
  "metadata":{"agent":"Compatible host","analysisVersion":"1"},
  "experiences":[{"text":"Patient education and care planning.","quote":"Patient education and care planning."}],
  "tracks":[{
    "id":"nursing","name":"Nursing","titles":["Registered nurse"],
    "keywords":["patient education"],
    "rationale":"Possible direction based on demonstrated work; confirm the user's interest.",
    "evidence":["Patient education and care planning."]
  }]
}
```

Metadata permits optional provider/model names and no credential fields. Aspirations and preferences are deliberately absent from agent proposals; the user provides them during onboarding. Quote checks establish extractive experience and lineage, not a guarantee that a suggested career direction is appropriate. Unsupported or ungrounded output is rejected with actionable errors and a safe failure record. The original resume is retained. Track IDs, text sizes and profile validation follow the documented profile boundary.

Agents must get explicit user authorisation before confirming a reviewed payload, creating a user-reviewed draft or approving a profile. A boolean in the local API represents the host's assertion of that explicit review, not a separate authentication system. The app remains a local single-user tool.

Synthetic nursing fixtures verify mixed contact redaction, preserved dates, unsupported formats, provider failure recovery, exact experience grounding, draft/approval separation, edited-profile ancestry, HTTP privacy and full private-backup recovery. These checks do not establish real-model quality or imply that the owner's resume has been imported.


## Reusable base CV and separate tailored drafts

The imported `resumes` text is an immutable local base version, not a disposable parsing result. List sources with `GET /api/v1/resumes`; read `/resumes/:id/history` and then the applicable `/resume-payloads/:id` to reuse reviewed text in a later session. Multiple bases require the user to choose or clarify the current version. The original PDF/Word binary is not stored; its parsed readable text is stored in the database and private backups. A corrected base is a new import, never an overwrite.

`ResumeVariants(app)` stores tailored resumes, cover-letter drafts and recommendations in migration `020-resume-variants.sql`:

| Method/path | Operation |
| --- | --- |
| `POST /api/v1/resume-variants` | Save an immutable draft; 201, or 200 for exact operationId retry |
| `GET /api/v1/resume-variants?baseResumeId=SOURCE_ID` | List reusable drafts for a base, metadata without full draft text |
| `GET /api/v1/resume-variants/:id` | Read a saved draft's full text and base/payload/parent/job lineage |

POST example:

```json
{
  "operationId":"host:cv-tailoring:1",
  "baseResumeId":"SOURCE_ID",
  "payloadId":"REVIEWED_PAYLOAD_ID",
  "jobId":"OPTIONAL_SAVED_JOB_ID",
  "kind":"resume",
  "label":"Analytics engineering CV — employer A",
  "text":"Full draft text for user review.",
  "changeSummary":"Reordered the confirmed platform ownership experience; no new achievements added.",
  "metadata":{"agent":"Compatible host","analysisVersion":"1"}
}
```

Kinds: `resume`, `cover_letter`, `recommendations`. `jobId` and `parentVariantId` are optional and otherwise must identify saved records. Payload and parent must belong to the base CV. Each new alteration uses a new operationId and may identify its parent variant; an exact retry returns the existing draft, changed content with the same operationId returns 409. Every draft remains labelled `status:draft`; saving does not approve facts, send a letter or submit an application. The host keeps achievements grounded in the reviewed base and presents uncertain suggestions for confirmation.

Full text is limited to one million characters; other text fields to 8000. Optional provider/model names in metadata must be actual available context, with no credentials. Lists omit full text; original base text remains outside agent payload endpoints until explicit payload review. Draft content is personal data and is included in private backups/JSON export, not the job-summary CSV.

Job deletion clears the live job reference while retaining the reusable draft, base, parent chain and target title/company snapshot. Removing a job does not erase the reusable CV library. Installation-wide explicit data removal removes the library; existing backup/export copies remain separate. Backup restore retains variants and supports older snapshots whose schema predates the variant table.
