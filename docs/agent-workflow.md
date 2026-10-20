# Conversation first, jobs table afterward

CareerVista is dedicated to Australian jobs across any profession. Keep search locations and job-site filters in Australia; remote roles must be available to someone working in Australia. Use AUD with explicit base/super and original pay periods.

The external agent owns intake, resume interpretation, query expansion, website operation and analysis. CareerVista validates and saves the results; its webpage presents the jobs table and evidence/reasoning in a modal. Ask questions in the agent conversation before searching or after inspecting an initial batch. The user need not fill out profile/run forms on the webpage.

Use the exact loopback origin supplied by the user. GET `/api/v1/agent-guide` discovers the installed version's API guides; GET each listed path returns `{name,markdown}`. Read `profiles` and `runs` before onboarding, `collection` and the relevant packaged source instructions before searching, and `assessments` before saving fit reasoning. All mutations use the documented HTTP API, never direct database writes. The host supplies browser/document tools, model configuration and credentials.

## 1. Understand the search

Read `language` first. Use explicit language instructions, then the saved preference, or infer from the user’s prompt when clear. Save the preference. For non-English explanations keep English originals and submit bilingual assessment translations. Display Chinese choices as 简体中文 and 繁体中文 only.

Read `history` when existing searches, deleted listings or application progress are involved. Preserve existing data by default; archive an old search on request. Respect Recently deleted suppression. Users can manage application records, contacts, document copies and due follow-ups directly in the job modal.

First GET `/api/v1/agent-guide/agent-intake` and use its adaptive interview. Ask exactly one question at a time through the host's available native question tool so choices are clickable. Put your recommendation first with a reason, allow custom free text and an undecided path, then wait for a submitted answer. Plain chat choices are a fallback only when the current host/mode lacks a suitable tool; explain that limitation once. Respect host-specific permission and attachment mechanisms. Probe title families, location, work arrangement, salary and base/super semantics, equity, leave, benefits, role quality and review priorities; reuse known answers and ask only consequential follow-ups. Ask which sites to search after the preference discussion, including SEEK, LinkedIn, Glassdoor, Indeed or user-supplied sites. Keep all intake and later refinement in the agent conversation.

Expand the seed role by responsibilities, seniority, domain and common title variants. Explain why each family belongs. For “principal analytics engineer”, consider principal/staff/lead analytics engineer and principal/staff data engineer where the work matches. Explore engineering manager (data), analytics engineering manager or data engineering manager as a separate leadership track only if management is in scope. A title is a search hypothesis, not proof of equivalent duties, salary, qualifications or the user's interest. This method applies to any profession in Australia; teaching, healthcare, trades and other roles need their own expansions.

Agree the proposed families and material boundaries in the conversation, using authorisation already given where sufficient. Save every approved title/keyword variant in the appropriate track, keeping distinct career directions separate. After intake (including any supplied CV) is complete, save the profile draft: use the resume-linked draft route when a CV was provided, otherwise POST a profile draft. Read back the exact saved version, show a compact summary and obtain explicit approval before activating it. `demonstratedExperience` holds confirmed factual strengths/competitive advantages; `aspirations` holds what the user wants next. Each track holds its expanded `titles` and `keywords`; shared or track `preferences` hold hard/soft/undecided conditions. Subsequent changes create a revision using `basedOnVersion`.

## 2. Optional resume, handled by the agent

For CV enhancement/tailoring, first GET `/api/v1/agent-guide/ax-cv`, the portable **老徐的简历修改** skill. It sets the four-page ceiling, voice and achievement rules; the steps below handle CareerVista persistence.

Read a user-supplied PDF, Word document or text with the host's document tools. If the host cannot read the file or it is scanned, explain the limitation and request readable text/OCR or continue without it. CareerVista does not convert/upload documents from the webpage.

Before sending resume content to any model, follow the host's data-sharing requirements and the user's authorisation. After parsing, persist the readable base CV through `POST /api/v1/resumes` with a stable importId, descriptive label, format `txt`/`paste` and its full parsed text. Read back the saved source ID/version, preview redaction, present the exact analysis payload for explicit review and save the confirmed payload. Return the base and payload IDs to the user; do not leave the base CV only in chat memory. Keep raw file parsing in the host; the database stores the parsed text, not the original PDF/Word binary.

Use reviewed source excerpts to identify factual competitive strengths, distinguish inference from demonstrated experience, confirm corrections and save the authorised facts in the profile. Follow the `resume` guide for grounded proposals and linked drafts. Review booleans assert real user confirmation in the conversation, never parser/agent output alone. The original imported text stays local and is included in private backups.

In later sessions, list `/api/v1/resumes`, get the chosen source's `/history`, and reuse its latest applicable explicitly reviewed payload. Ask which base to use if multiple versions are ambiguous; do not require the file to be uploaded and parsed again. Respect the user's current authorisation for the host/model to read that saved payload.

For tailored CVs, cover-letter drafts or change recommendations, read the `resume` guide and POST `/api/v1/resume-variants`. Each immutable draft references the baseResumeId, reviewed payloadId, kind, label, full text, changeSummary and actual agent metadata; add jobId for job-specific work. Save revisions with new operationId and parentVariantId, keeping the base and previous drafts intact. Reuse an existing variant by fetching its ID and creating a new child draft rather than editing it in place. Label generated output as a draft requiring review; preserve factual achievements and record any unverified suggestions as recommendations, not proven experience. Creating a draft never submits an application.

## 3. Agree and run a bounded search

Agree sources, a listing limit and a spending cap/currency, then create the run through `runs` using the approved profile revision and track IDs. Creating a run does not invoke a model. Host subscription/usage terms and actual billing remain with the host; when usage is not available, record conservative estimates and label actual cost unknown. If the host cannot supply a defensible estimate, ask for a workable boundary rather than pretending to enforce a token or monetary cap.

Plan each selected source using all approved variants. Search across role families before declaring coverage complete; record zero results, access failures, skipped queries and budget/limit truncation distinctly. Use the collection guide’s deferred preview discovery and screening before detailed capture. Prefer batch host search tools and public employer APIs, then browser evidence where needed. Cover approved families before filling the detailed limit. Select candidates on actual duties and requirements. Duplicate cross-posts should not crowd out varied candidates. Retain unattractive or uncertain captured jobs with their explanations, rather than hiding contrary evidence or silently relaxing hard requirements. A bounded batch is not a claim to have found every available job.

Authorise work and reserve model estimates before browsing/analysis as the run contract requires. Save readable original evidence and source URLs/times before extraction; deduplicate using the reconciliation contract. Record checkpoints so interrupted work resumes without repeating completed captures. Pause in the same controlled browser for user sign-in or verification. The user enters website credentials directly; resume only after their confirmation.

## 4. Analyse in the agent and persist the explanation

Use the host's model to compare saved evidence against confirmed strengths, aspirations and the approved track. Submit structured listing fields, compensation with original units/provenance, and an assessment through the documented APIs. CareerVista validates quotes and derives its transparent fit label from the submitted axes/conflicts; it performs no LLM analysis.

Each assessed job needs evidence-linked `reasonsToPursue` explaining its relevance to this person's strengths/goals, separate `concerns`, material `unknowns`, useful follow-up `questions`, and independent evidence `confidence`. Quote the saved listing for known claims. Distinguish employer claims, external reports, model inference and user-confirmed facts. Missing information is unknown, not a disqualifier. A senior-sounding title alone cannot establish fit or an opportunity to use someone's competitive advantages.

Read back the saved analyses/assessments and verify their job/profile/evidence IDs before marking work assessed or excluded. Record partial failures and preserve the evidence if analysis cannot finish. A model's recommendation never silently sets the user's save/dismiss decision or application status.

## 5. Hand the finished batch to the user

When all queued work is complete, complete the run. If a budget, access failure or other boundary stops work, save the truthful paused/stopped state and say what remains. Report query-family/source coverage, unique saved/assessed counts, the most useful tradeoffs, uncertainty and any limits. Ask targeted questions in the conversation when the results call for refinement; explicitly approve any changed hard constraints and retain historical assessments when reassessing cached evidence.

Then provide the exact running webpage URL and invite the user to browse the table and open roles for “Why this job is here”, concerns and source evidence. The page refreshes periodically while visible. The user can return to the agent with a role/company to request more research, save/dismiss, refine preferences or report application progress. Record only explicitly authorised decisions via the relevant APIs. Application submission and messages always require separate explicit instructions.
