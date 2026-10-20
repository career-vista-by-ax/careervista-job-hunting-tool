---
name: careervista-job-search
description: Start or resume an Australian job search with CareerVista. Guide Docker or local-app setup, then clarify goals and save evidence-backed recommendations using the agent's own tools.
---

## First decision: privacy acknowledgement

Before setup, intake, reading career records/documents or using research tools, read [references/user-consent.md](references/user-consent.md), show its full notice and wait for **I understand and agree to continue** or **Stop — do not proceed**. When a permitted native choice tool is available, **call it** with both choices; the user can click an answer and typing is optional. This acknowledgement has no recommended answer. An explicit agreement already given to this notice in the same conversation covers handoffs between these skills. Until agreement, perform only the instruction/question-tool checks allowed in that reference. A stop or missing/ambiguous answer leaves all workflow work pending.

Use this skill with any agent that can read Markdown instructions. Shell, loopback HTTP, browser and document tools belong to the host; use its available equivalents. If a capability is absent, explain the specific limitation and offer a manual step. Invocation syntax belongs to the host (for example `$careervista-job-search` in Codex, or asking to use this skill by name).

## Clickable questions, including setup

Before asking the first question, check the host's available tools for a native ask-user, structured-question or choice-picker interface. When available in the current mode, **call that tool** so choices are clickable; writing numbered options or Markdown checkboxes in chat is not a substitute. Use the host's equivalent rather than requiring a particular provider or tool name. Apply this to runtime/language choices, intake, search scope, follow-ups and document-editing choices.

Ask one question per call. Put the recommended choice first and label it, give a short reason, offer two or three useful choices and retain custom free text and an undecided path. Use the host's built-in custom-answer field instead of a duplicate Other option. For personal factual/numeric values such as salary ranges, day rates, dates or exact targets, call the tool’s free-text/numeric mode without preset answers; the user enters their own value. Provide format guidance, not recommended amounts. Keep categorical decisions clickable. Wait for the user's submitted answer; a preselected choice, timeout or silence is not consent. With an asynchronous question, keep dependent work pending and continue only independent work.

If no suitable question UI is available in the current host/mode, briefly explain that limitation once, then offer concise numbered choices with custom input in chat. Do not claim text is clickable or build a separate website merely to ask questions. File attachments use the host's attachment mechanism. Permission requests must use a surface allowed by the host's rules; an answer does not bypass execution approvals.

## Connect before intake

A running CareerVista app is a separate dependency, not part of installing this skill. Read [references/setup.md](references/setup.md) to reuse a saved connection or guide first-time Docker/local setup. Ask one question at a time. Docker pull/start/update requires the user's permission for the concrete image, container, data volume and loopback port. A local download requires the user's chosen release/path. Keep existing work intact. Finish setup only after the exact returned localhost origin answers `/api/v1/agent-guide`.

## Guided search

GET `/api/v1/agent-guide`, `/api/v1/agent-guide/agent-workflow`, `/api/v1/agent-guide/agent-intake` and `/api/v1/agent-guide/language` from that origin. Follow the running app’s current contracts. After the privacy acknowledgement, read `agent-tasks` when available for compact task-level helpers over the same HTTP API; use the raw API when the installed version lacks them. Read `capture-interface` before saving listings and the selected source's guides (`seek`, `linkedin`, `collection` or `custom-sources`) before browsing. These HTTP guides make source collection available even when no separate capture skill is installed.

Search headless first: batch the agreed keyword/location variants with host search tools and public APIs, then read selected original pages with headless HTTP or the Docker Playwright helper described in `collection`. Open the user’s default host browser only for an observed login/verification/access barrier or unavailable headless capability, stating the reason. Stop headless requests for a blocked source; keep accessible sources moving. Verify actual query/location and readable original content before saving evidence; snippets and suspicious responses remain unverified. This access order also applies when an older running app’s source guide says to open a browser immediately.

Explicit language instructions take priority, then the saved preference. The user's own prompt language is a signal when none is established; confirm only when ambiguous. Save the choice through the language API. Display names are English, 简体中文 and 繁体中文. Keep English source evidence and save bilingual explanations through the language guide.

Use the user's custom goals, or begin the guided Australian job-search intake when none are supplied. Ask one consequential question at a time with a recommendation, choices, custom input and an undecided path. Reuse settled answers. Clarify responsibilities and related titles, strengths from an optional readable resume, Australian location, working arrangement, employment, AUD pay and base/super semantics, equity, leave, benefits and review priorities. Then agree sites, scope, listing limit and spending boundaries before researching and saving evidence-linked recommendations. Complete/checkpoint the run, verify saved records and send the user to the current jobs-table URL.

Existing data is preserved by default. For a fresh search with current jobs, offer continuing or archiving; read the `history` guide after the user's choice. Full reset is a separate two-confirmation action in Local data. Respect Recently deleted suppression and `job_in_trash` responses. Record only user-confirmed application facts. Application submission is a user-only handoff; this skill never submits or completes application forms. Outbound messages are outside this flow.

## When the user chooses to apply

Offer CV/cover-letter tailoring and a simulated 30-second reader review. Fetch the app's `ax-cv` and `ax-30-secs` guides, or use those standalone skills when available. Ask whether the user prefers manual edits in their own tool, a separate agent-created draft, or authorised editor control; honour an editing mode already chosen. Save distinct variants and exact copies used, then let the user record their own progress.

Recommend applying through the original advert on the website where this job was found and clicking that site's Apply button. Preserve job-board link-outs; never bypass them with extracted, redirected or guessed direct employer/ATS application links. A direct employer advert is valid only when the job was found there originally. Ask for the original advert if provenance is unclear. Preparing documents does not submit an application, send a message or mark the job applied.
