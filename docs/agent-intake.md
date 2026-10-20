# Adaptive intake: one question at a time

Use this guide when starting/refining a search or discussing resume strengths. This product searches the Australian job market only, across any occupation. Keep the conversation in the agent. Read available profile/history and the user's messages first; reuse settled answers. Follow a decision tree: ask only the next question whose prerequisites are known, then wait for the reply. Recompute the next question after each answer. This is a probing interview with advice, not a form or a batch questionnaire.

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

## Decision tree and coverage

Cover the following decisions before finalising search scope, in the order dependencies permit. Previously supplied answers count; acknowledge them briefly and move on. A user may skip a preference, proceed with an exploratory batch, or return to it after seeing results. Record skipped/unclear criteria as undecided, not as hard filters. Split follow-ups into separate turns.

| Decision | What to establish | Helpful recommendation or follow-up |
| --- | --- | --- |
| Role direction | Seed title, meaningful duties, seniority, IC/manager interest | Expand related titles by actual scope; keep career directions in distinct tracks. For principal analytics engineering, consider staff/lead analytics engineering and relevant data roles; management needs the user's interest. Use equivalent reasoning for any occupation in Australia. |
| Location | Australian state/territory, city/region and relevant Australian time zone | Suggest nearby Australian regions or compatible Australian time zones where useful. Ask relocation or commute tolerance separately if it changes coverage. |
| Work arrangement | Remote only, hybrid or on site | Remote-only is a hard restriction only if the user chooses it. For hybrid, ask acceptable office-day frequency in the next turn. Remote means a role available to someone working in Australia; verify Australian hiring eligibility and location limits. |
| Employment | Permanent, fixed term, contract, part time or other | Recommend comparing like-for-like compensation; a daily contract rate is not an annual base salary. Ask hours/flexibility separately when relevant. |
| Salary range | Desired floor/target/range | Offer ways to express the range, rather than inventing an appropriate amount. Use AUD; clarify annual, hourly or contract units in a separate turn if unclear. |
| Base and super/package | Whether that range is base excluding super, total package including super, or undecided | Suggest keeping base and super explicitly separate for comparison. Ask which interpretation applies; never silently convert or assume the current contribution rate. |
| Equity | Whether equity matters, and preferred form/weight | Treat equity as uncertain upside unless the user chooses a different tradeoff. Ask separately whether it can compensate for lower cash; do not assume an option's valuation or liquidity. |
| Annual leave | Desired paid leave and its importance | Offer standard company allowance acceptable; prefer extra leave (for example, more than 20 days); or custom target. This is a preference example, not a legal minimum. Clarify purchased leave, shutdown deductions or pro-rata terms only if material. |
| Other benefits | The benefits that would change the decision | Suggest relevant examples: flexible hours, parental leave, learning budget, health cover, extra super/pension, bonus, equipment or wellbeing days. Ask the user for their top priority, then branch to further benefits one at a time as needed. |
| Role quality | Desired impact, ownership and decision authority | Recommend judging concrete duties and approval layers over title or company size. Ask one dimension at a time; flag when a leadership path changes the type of ownership. |
| Workplace evidence | Whether to investigate Glassdoor/other reviews and what concern to focus on | Suggest targeted checks for management, workload, progression or work-life balance, alongside employer evidence. A rating alone is weak evidence. Ask which matters most in a separate turn if needed. |
| Other constraints | Industry interests/exclusions, travel, commute, schedule, accessibility needs, start date or Australian work-rights/sponsorship requirements | Ask only consequential gaps for this user/role. Keep personal details minimal; record job constraints rather than unnecessary sensitive information. |
| Strength of constraints | Which selected conditions are must-haves versus tradeoffs | Recommend keeping uncertain or negotiable criteria soft initially. Resolve material strictness one condition at a time instead of silently making every answer an exclusion. |
| Sites | Which sources to search | Ask this after the preference discussion: SEEK, LinkedIn, Glassdoor, Indeed, employer career pages, another URL, or a custom combination. Recommend sources based on the Australian profession and actual access; keep job searches filtered to Australia. Ask for a site preference rather than fixing these four globally. |
| Search bounds | Batch size and budget | Propose a bounded exploratory batch; ask limit and spending cap/currency in separate turns when not yet authorised. Explain known host costs versus conservative estimates. |

## Flexible sources and review access

Selected sites are browser-controlled research sources, not a promise of bundled integrations. Use an already connected suitable MCP when available and authorised; otherwise use the host browser. Follow the packaged SEEK/LinkedIn instructions for those sources. For Glassdoor, Indeed, employer pages and unfamiliar sites, load the `custom-sources` guide and inspect actual visible search controls. Agree the starting origin and scope in the conversation, create the exploration through the API and record supported/partial/unsupported outcomes. Reusable workflow approval is a separate user review in the conversation. Do not require the user to open a web configuration form.

Glassdoor company reports use the `company` guide. Open the source in the controlled browser, pause for the user to sign in or complete verification, then resume the same session after their confirmation. Do not collect passwords/cookies, bypass access controls or pretend inaccessible reviews were read. Retain source URL, date/team/location context, company-name linkage, relevant quotations and conflicting reports before an agent summary. Avoid definitive culture judgements from anecdotes. Failed access stays an explicit limitation.

## Close the interview, then research

Present a concise summary of confirmed strengths, aspirations, expanded title families, hard/soft/unknown preferences, selected sources and agreed bounds. Ask one approval question for that concrete summary. Use existing authorisation where it already covers the exact saved scope; unresolved material changes still need an answer. Save/read back the draft and activate it only on real confirmation. When a CV is supplied and parsed, save its readable base text and explicitly reviewed payload through the resume API for reuse, then record authorised strengths in `demonstratedExperience`. Keep tailored CVs, cover letters and recommendations as separate linked variants; follow the resume guide for source lineage. The user may also search without supplying a CV.

Then follow the search/analysis/checkpoint workflow. Ask later questions only when real findings expose an important unknown or tradeoff, again one at a time with recommendations and custom input. A completed/explicitly bounded batch is handed to the webpage for browsing; further refinement stays in the agent conversation.
