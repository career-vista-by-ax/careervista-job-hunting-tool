# Adaptive intake: one question at a time

Before any career workflow, follow the `user-consent` guide (`GET /api/v1/agent-guide/user-consent`) unless its notice has already been explicitly accepted in this conversation. Present the notice and wait before setup checks, intake, career-record/document reads, browsing or writes. A stop or missing agreement ends or holds the workflow. This gate precedes the steps below.

Use this guide when starting/refining a search or discussing resume strengths. Search any occupation in the user’s target job market. Keep the conversation in the agent. Read available profile/history and the user's messages first; reuse settled answers. Follow a decision tree: ask only the next question whose prerequisites are known, then wait for the reply. Recompute the next question after each answer. This is a probing interview with advice, not a form or a batch questionnaire.

## Start with optional CV context

After consent and a verified connection, reuse an authorised reviewed CV/profile if available. Otherwise offer a CV before asking role or preference questions, with this one-line recommendation **before upload**:

> I strongly recommend removing personal identifiers (name, email, phone, street address, date of birth, photo and personal profile links) and sharing a Word (.docx) or TXT CV, so those details are not sent to the agent; you can also continue without a CV.

Use the host’s attachment mechanism; a choice tool is not a file uploader. Read an already supplied readable CV without requesting it again. Accept PDF when readable, explain extraction/OCR limitations and keep the no-CV path equally usable. Removing identifiers before upload prevents their disclosure to the agent; an already uploaded document may already have reached the host/model. Never claim otherwise.

Before any CareerVista write, remove remaining personal identifiers from parsed CV text, source labels, reviewed payloads, profile facts and summaries. Persist only the sanitised base, using neutral labels such as “Base CV”; do not import an unredacted original and rely on the later payload preview to protect storage. The API stores submitted text and backups retain it; this instruction is an agent safeguard, not an automatic storage filter or a guarantee about existing records. For saved records, prefer the authorised reviewed payload and sanitise reused content without silently rewriting history. Build external search queries only from role/skill terms and the approved job market, never candidate names, contact details, personal links, CV excerpts or identifiable career histories. Use city/region-level preferences rather than a home address.

Parse once to identify demonstrated responsibilities, skills, achievements, relevant experience, qualifications and possible role families. Without a CV, use the user’s supplied experience; declining a CV is not itself evidence of a qualification gap. Use that context to recommend choices and skip settled questions. Keep inferred strengths provisional until confirmed; a CV describes past experience, not necessarily the desired next job. Follow the resume API’s explicit payload review and profile-approval contracts; save the sanitised base and reviewed payload for reuse.

## Resolve location and recommend sources

Resolve the target market from the user’s explicit goals first, then the applicable saved search preferences. CV or host-provided city/country/timezone can suggest a default when consistent with the conversation; language alone is not a location. A current address or timezone does not establish relocation plans, work rights or remote hiring eligibility. State a reliable inferred default with an easy override instead of asking a redundant location question. If the target is missing, conflicting or ambiguous, ask one clickable location question with suggested markets and custom input; ask city/region later only if needed. Never probe precise device location or send personal data to a geolocation service for this purpose.

Recommend a small source mix for the target country, occupation and actual access. For Australia, SEEK Australia and LinkedIn can be starting candidates; for other markets, verify relevant regional/generalist, specialist, government and employer sources with the host’s available tools instead of assuming a universal board list. Keep company-review sources separate from listing sources. Cache useful source recommendations within the search context and revisit only when the market, role or access changes. Always allow custom websites, employers and keywords. Agree material source changes within the existing scope/approval rules.

Use the app’s available adapters honestly: the built-in SEEK adapter accepts Australian SEEK hosts only. Other regional SEEK/JobStreet/JobsDB sites and unfamiliar boards use the approved custom-source workflow, not an Australian adapter with a foreign location. Use the target market’s currency and compensation terminology; base/super questions apply where relevant, rather than to every country. Preserve listing text and verbatim quotes in their original language; keep canonical assessment explanations in English and use the supported translation API separately. Preserve source units, unknowns and the installed API’s supported fields; never invent a regional integration or silently coerce unsupported data.

## Recommend grounded progression

Recommend role families using actual duties and demonstrated scope, not exact titles or years alone. Consider independence, complexity, ownership, impact, domain depth and qualifications; for management, seek evidence of people leadership and organisational responsibility. Do not infer ambition, age or management ability from tenure. For a junior with 2–3 years, intermediate roles can be a sensible next step; selected senior individual-contributor roles need supporting ownership/depth. That tenure alone does not support a Senior Manager recommendation. Titles and progression vary by employer and profession; regulated qualifications remain material.

Explain proposed directions as strong fit, plausible next step or stretch, with supporting evidence and gaps. These are conversational descriptions, not new API fit labels. Offer related titles and responsibility/skill searches, including plausible progression beyond the user’s literal title; keep IC and management directions in separate tracks and obtain the user’s interest before adding a different career direction.

When the requested level lacks CV support, acknowledge that the CV may omit relevant experience. Name the missing evidence respectfully and use the native choice tool before dependent work, for example:

> Your CV shows delivery experience, but I don’t yet see the team leadership and organisational scope these Senior Manager roles typically require. How would you like to proceed?
>
> Choices: Add relevant experience (recommended); Adjust the target level; Keep the higher target. Allow custom input or an undecided path through the host’s supported controls.

Wait for the submitted answer. New context can justify revising the recommendation; confirm factual additions rather than inventing qualifications. If the user keeps the higher target, honour it within the agreed bounds, distinguish stretch results and explain evidence gaps. Remember the choice instead of repeatedly challenging it. Missing evidence is unknown, not proof of inability or an automatic exclusion.

## Broad search, bounded analysis

The agent performs the searches; the user approves directions and boundaries, not every synonym. Save approved equivalent titles, local spellings, responsibility and skill terms in the relevant tracks. Cover meaningful role families, target locations and approved sources before filling the detailed-capture limit. Do not turn a five-listing assessment limit into five search queries. Prefer several distinct, useful searches to repeated wording changes; stage coverage across checkpoints when API planning limits require smaller runs. Report uncovered families rather than claiming exhaustive coverage.

Search job boards and original employer listings first, using date-posted filters and newest-first ordering where supported, plus a relevance pass for suitable older adverts. Verify visible query/location/date/sort state and record the applied settings in compact run notes/checkpoints. Promoted placement is not proof of freshness or fit. Record observed posting/update dates separately from capture time in supported evidence/context; missing dates stay unknown, and a repost/update does not establish the original publication date.

Search engines supplement coverage: discover regional boards/employer careers, find gaps or alternative original sources after access problems. Use whichever search service the host provides; adapt site filters, Boolean expressions or separate simple queries to its documented capabilities. Check that restrictions actually applied rather than assuming Google syntax works everywhere. Indexed results cannot preserve board order, guarantee current vacancies or establish zero board results. Verify selected jobs against readable original evidence, including whether applications are still open when observable.

Within the agreed discovery, attempt, detailed-listing and spending limits, batch independent queries, screen compact previews, deduplicate cross-posts and reuse saved evidence. Continue distinct queries while they yield useful new candidates; checkpoint/stop when coverage is complete, useful new yield dries up or an agreed bound is reached. Extend families, locations or bounds only with the required user authorisation. Report actual queries/coverage, dates checked, duplicates, access gaps and unverified freshness. Measure savings when available; never promise a fixed token reduction.

## Every question

1. Ask one focused question about one decision.
2. Give a short recommendation with a reason grounded in the user's goals or clearly labelled as a starting suggestion.
3. Check for the host's native ask-user/structured-question/choice-picker tool available in the current mode. When available, **call it** with one question item so answers are clickable; ordinary numbered text or Markdown checkboxes do not satisfy this requirement. Put the recommended choice first, offer two or three useful choices plus custom free text and an undecided/skip path, and use the built-in custom-answer field rather than a duplicate Other option. Use free-text mode for open factual questions when supported. If no suitable UI exists, explain that limitation once and present numbered chat choices with custom input. Use the host's permitted approval and file-attachment mechanisms where applicable.
4. Wait. Silence is not consent. A “yes” may accept the stated recommendation; arbitrary assent must not approve unseen terms or hard exclusions.

Recommendations are provisional. Briefly challenge contradictory answers and explain consequences, without arguing the user into your preferences. Look up factual market/site information with the host's tools when needed; label estimates and uncertainty. Never invent a salary benchmark, statutory leave entitlement, company policy or review score. Asking one question does not mean hiding several decisions in its wording.

Example question content after the user says “principal analytics engineer” (send this through the native question tool when available, not as a plain-chat questionnaire):

> Should we keep this search on the senior individual-contributor path, or include people-management roles too?
>
> I suggest starting with principal/staff/lead analytics engineering, because these titles can describe similar scope. Data engineering manager is a distinct path; include it if you want to manage people.
>
> Suggested choices: senior IC only (recommended); IC plus data leadership; undecided. Allow a custom direction, such as exploring management first.

After the answer, ask the next missing question. Do not append a location or salary question to that turn.

For asynchronous tools, keep dependent work pending until an answer arrives. A default/preselected choice, timeout or silence is not a submitted answer. This rule applies during setup before intake and during later refinement as well; use each host's equivalent tool rather than requiring a specific agent provider.

## User-entered values

Use the host's native free-text or numeric question field for personal factual/numeric values such as salary ranges, contract/day rates, availability dates, hours or an exact leave target. The user types their value; provide units/format guidance, not recommended amounts, preset salary bands or invented personal facts. A native question tool can be called without suggested answers for these fields. The user may answer undecided or skip. Keep categorical decisions clickable: for example annual/hourly/day rate, base pay versus total package (including super where relevant), or remote/hybrid/on-site. Ask for an interpretation separately from the amount when necessary.

## Decision tree and coverage

Cover the following decisions before finalising search scope, in the order dependencies permit. Previously supplied answers count; acknowledge them briefly and move on. A user may skip a preference, proceed with an exploratory batch, or return to it after seeing results. Record skipped/unclear criteria as undecided, not as hard filters. Split follow-ups into separate turns.

| Decision | What to establish | Helpful recommendation or follow-up |
| --- | --- | --- |
| Role direction | Seed title, meaningful duties, seniority, IC/manager interest | Expand related titles by actual scope; keep career directions in distinct tracks. For principal analytics engineering, consider staff/lead analytics engineering and relevant data roles; management needs the user's interest. Use CV-informed hints and grounded progression for any occupation; keep aspirations distinct from experience. |
| Location | Target country/market, city/region and relevant time zone | Reuse a reliable stated/saved/inferred target; ask only for missing or conflicting location details. Ask relocation or commute tolerance separately if it changes coverage. |
| Work arrangement | Remote only, hybrid or on site | Remote-only is a hard restriction only if the user chooses it. For hybrid, ask acceptable office-day frequency in the next turn. Verify remote hiring eligibility for the user’s intended working country and any location/time-zone limits. |
| Employment | Permanent, fixed term, contract, part time or other | Recommend comparing like-for-like compensation; a daily contract rate is not an annual base salary. Ask hours/flexibility separately when relevant. |
| Salary range | Desired floor/target/range | Ask through a native free-text/numeric field for the user’s own amount or range in the target market’s currency, with optional floor/target. Give format guidance only; omit suggested salary bands/amounts. Clarify annual, hourly or contract units in a separate turn if unclear. |
| Compensation basis | Base pay, total package, relevant pension/super/bonus components, or undecided | Use market-appropriate terms and separate components. For Australia clarify base excluding super versus package including super; never silently convert or assume contribution rates. |
| Equity | Whether equity matters, and preferred form/weight | Treat equity as uncertain upside unless the user chooses a different tradeoff. Ask separately whether it can compensate for lower cash; do not assume an option's valuation or liquidity. |
| Annual leave | Desired paid leave and its importance | Offer standard company allowance acceptable; prefer extra leave (for example, more than 20 days); or custom target. This is a preference example, not a legal minimum. Clarify purchased leave, shutdown deductions or pro-rata terms only if material. |
| Other benefits | The benefits that would change the decision | Suggest relevant examples: flexible hours, parental leave, learning budget, health cover, extra super/pension, bonus, equipment or wellbeing days. Ask the user for their top priority, then branch to further benefits one at a time as needed. |
| Role quality | Desired impact, ownership and decision authority | Recommend judging concrete duties and approval layers over title or company size. Ask one dimension at a time; flag when a leadership path changes the type of ownership. |
| Workplace evidence | Whether to investigate Glassdoor/other reviews and what concern to focus on | Suggest targeted checks for management, workload, progression or work-life balance, alongside employer evidence. A rating alone is weak evidence. Ask which matters most in a separate turn if needed. |
| Other constraints | Industry interests/exclusions, travel, commute, schedule, accessibility needs, start date or target-market work-rights/sponsorship requirements | Ask only consequential gaps for this user/role. Keep personal details minimal; record job constraints rather than unnecessary sensitive information. |
| Strength of constraints | Which selected conditions are must-haves versus tradeoffs | Recommend keeping uncertain or negotiable criteria soft initially. Resolve material strictness one condition at a time instead of silently making every answer an exclusion. |
| Sites | Which sources to search | After resolving market and role, suggest a small researched mix of relevant job boards and employer sources, with custom URLs/combinations. Reuse settled choices; distinguish company reviews from vacancy discovery. Avoid a fixed global board list. |
| Search bounds | Batch size and budget | Propose a bounded exploratory batch; ask limit and spending cap/currency in separate turns when not yet authorised. Explain known host costs versus conservative estimates. |

## Flexible sources and review access

Selected sites are research sources, not a promise of bundled integrations. Follow `collection` Headless-first access: use original job-board/employer searches and public APIs through headless reads, with default-host-browser fallback for an observed access barrier. Search engines supplement coverage. An already connected suitable MCP can be used within the same access and authorisation boundaries. Follow the packaged SEEK/LinkedIn instructions for those sources. For Glassdoor, Indeed, employer pages and unfamiliar sites, load the `custom-sources` guide and inspect actual visible search controls. Agree the starting origin and scope in the conversation, create the exploration through the API and record supported/partial/unsupported outcomes. Reusable workflow approval is a separate user review in the conversation. Do not require the user to open a web configuration form.

Glassdoor company reports use the `company` guide. Inspect actual access using the headless-first order. At a login/verification wall, stop headless requests to that source, open it in the default host browser and pause for the user to sign in or complete verification, then resume that session after confirmation. Do not collect passwords/cookies, bypass access controls or pretend inaccessible reviews were read. Retain source URL, date/team/location context, company-name linkage, relevant quotations and conflicting reports before an agent summary. Avoid definitive culture judgements from anecdotes. Failed access stays an explicit limitation.

## Close the interview, then research

Present a concise summary of confirmed strengths, aspirations, expanded title families, hard/soft/unknown preferences, selected sources and agreed bounds. Ask one approval question for that concrete summary. Use existing authorisation where it already covers the exact saved scope; unresolved material changes still need an answer. Save/read back the draft and activate it only on real confirmation. When a CV is supplied and parsed, save only its sanitised readable base text and explicitly reviewed payload through the resume API for reuse, then record authorised strengths in `demonstratedExperience`. Keep tailored CVs, cover letters and recommendations as separate linked variants; follow the resume guide for source lineage. The user may also search without supplying a CV.

Then follow the search/analysis/checkpoint workflow. Ask later questions only when real findings expose an important unknown or tradeoff, again one at a time with recommendations and custom input. A completed/explicitly bounded batch is handed to the webpage for browsing; further refinement stays in the agent conversation.
