# Resume-assisted onboarding

Use **Import resume** for UTF-8 `.txt` or pasted text. PDF, DOCX and images receive a clear text-export/paste fallback. Original text is retained privately in the domain database and private backups; no model request is made automatically.

Import produces a default contact-redacted preview, including common name/header, email, phone, address and contact URL patterns. Review/edit that exact payload and explicitly confirm before sharing it with a chosen agent. Redaction is a starting point, not a guarantee for every resume layout. Only the reviewed payload endpoint is intended for agent analysis; original resume text is not included in HTTP import/history responses. The source stays available through the local in-process application seam and private backup, so backups remain personal data.

`ResumeService(app)` public operations: `importResume({importId,label,format:'txt'|'paste',text})`, `payloadPreview(resumeId)`, `reviewPayload(resumeId,{operationId,text,confirmed:true})`, `agentPayload(payloadId)`, `submitProposal(input)`, `recordFailure({resumeId,operationId,code})`, `history(resumeId)`, `createProfileDraft({operationId,proposalId,profile,confirmedReview:true})`.

HTTP:

| Method/path | Purpose |
| --- | --- |
| GET/POST `/api/v1/resumes` | List metadata / import readable text |
| GET `/api/v1/resumes/:id/preview` | Default-redacted review payload |
| POST `/api/v1/resumes/:id/payloads` | Explicitly confirm an edited analysis payload |
| GET `/api/v1/resume-payloads/:id` | Agent reads reviewed payload only |
| GET `/api/v1/resumes/:id/history` | Payload/proposal/failure/profile lineage |
| GET/POST `/api/v1/resume-proposals[/:id]` | Read/submit grounded suggestions |
| POST `/api/v1/resume-failures` | Safe provider_failure/malformed_output/invalid_proposal code |
| POST `/api/v1/resume-profile-drafts` | Explicitly reviewed, editable linked profile draft |

A proposal contains `submissionId`, `resumeId`, `payloadId`, `metadata:{agent,analysisVersion,model?,provider?}`, `experiences:[{text,quote}]` and `tracks:[{id,name,titles,keywords,rationale,evidence:string[]}]`. Every experience is extractive (`text === quote`) and must appear in the reviewed payload; suggested track rationales cite the reviewed content. Possible directions are suggestions rather than evidence the user wants them. The proposal cannot include aspirations. The user separately supplies aspirations, selects directions, and edits preferences during onboarding.

Creating a linked profile is atomic and retry-safe, but creates a draft only. **Profile & search tracks** previews effective shared/track preferences and performs the separate explicit approval. Editing an existing profile can supply `basedOnVersion`; ancestry remains traceable. Failures retain source, reviewed payload and safe failure metadata, without storing provider exception text or credentials.
