# Resume import and explicit onboarding

Choose **Import resume** in the toolbar. CareerVista supports pasted readable text and UTF-8 `.txt` files, up to one million characters. PDF, DOCX, scanned images and other formats require exporting to plain text or pasting readable content. Unsupported formats and invalid UTF-8 are rejected with a fallback; they are never partly ingested. There is no document parser or model call in this module.

The original source is stored in the local domain database and private backups. Import creates a new immutable source version. It does not create or activate a profile. The import HTTP response omits original source text. The app never reads or sends unrelated notes, credentials or browser sessions.

## Review the analysis payload

The default `contacts-v1` redaction removes email addresses, phone-like numbers, URLs, street-address lines, explicit contact/name/date-of-birth fields and likely first-line names, including mixed name/role headers. Employment year ranges and ISO dates are preserved. Redaction is conservative and may remove useful headers or miss unusual contact formats; the preview explicitly asks you to inspect every line and edit the exact payload. This preview is the content to be analysed, rather than an assurance that arbitrary documents contain no personal information.

Choose **Confirm reviewed payload** only after reviewing the text. Each confirmation saves an immutable reviewed payload. The agent-facing endpoint returns only that reviewed version, its IDs, source version, redaction version and review time. It does not include the original source, source label, unrelated notes or optional onboarding answers. Edited payloads can deliberately restore text removed by the default; confirmation authorises that exact content. No payload is automatically sent to a provider. Private backups intentionally retain original resume contact details and must be stored privately.

Any compatible agent/model can read the reviewed payload and submit grounded suggestions. Provider settings and optional credentials belong to the host. When unavailable, leave provider/model identity absent rather than inventing it. Ask the agent to quote demonstrated experience verbatim; the app rejects a generated achievement whose text is not an exact quote in the reviewed payload. Suggested career tracks/title variants/keywords need supporting quotes and a rationale, but remain possible directions, not proven qualifications or inferred aspirations.

Choose **Refresh suggestions**, then **Choose directions & answer onboarding**. Correct factual experience, supply aspirations in your own words, choose tracks explicitly and set optional hard/soft/undecided preferences. No track is selected by default; missing aspirations/preferences can remain undecided. Creating a linked profile is a separate explicit action and produces an unapproved draft. Review its effective preferences in **Profile & search tracks**, edit as needed, then explicitly approve. The source → reviewed payload → proposal → profile relation remains stored. Subsequent profile edits use `basedOnVersion` ancestry and remain traceable to the source without automatically approving them.

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
