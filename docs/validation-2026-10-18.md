# Development acceptance evidence — 18–19 October 2026

This record separates observed development checks from remaining release acceptance. Test data is synthetic profiles plus public job descriptions in an isolated local installation; no owner resume or actual application was imported/submitted.

## Live browser and agent checks

Host: Codex desktop browser-control tools, Chrome extension with the user's existing browser session. Public loopback JSON interface; model/provider identity not exposed by the host was omitted rather than invented. Host remains optional and replaceable.

- SEEK: searched analytics engineer/Melbourne, opened [Credit Clear listing](https://au.seek.com/job/95247178), captured readable original text and saved through the local UI into job `e4d66621-8a63-4879-9835-1aef810daa71`. Signed-out read succeeded; no sign-in challenge encountered. No Apply action performed.
- LinkedIn: used existing authenticated browser session, searched analytics engineering and opened [Kraken energy listing](https://www.linkedin.com/jobs/view/4461946533/), saved readable description into job `f12bb82d-3935-4146-9b2d-edb88c35034e`. Search UI showed Australia despite the URL's Melbourne parameter; do not claim URL parameters alone enforce location. Asynchronous detail rendering required verifying title/company after load. No new password requested or copied.
- Website-provided enrichment incorrectly conflated energy-utilities Kraken with the cryptocurrency exchange in competitor text. That generated insight was excluded from capture. Employer identity must be checked separately from name similarity.
- Read and exercised bundled `careervista-capture` v1 instructions: persisted evidence first, then Codex produced grounded extraction and submitted through `/api/v1/analyses`. Both succeeded with actual agent metadata. The original capture lacked some page-header fields; these remained Unknown rather than inferred from surrounding recommendations.
- Reviewed quote coverage and appended corrected analyses without replacing originals. Latest IDs: SEEK `37c9ee27-7b45-47e6-bdda-038f527d1f60`; LinkedIn `c60d081b-1faf-4dff-9187-2a9ce4966392`. The first pass summarised multiple requirements using too narrow a cited excerpt; correction cited the complete requirements passage or narrowed the summary. Quote validation establishes lineage, not semantic completeness; human/agent review still matters.
- Opened the modal and verified structured fields, explicit unknown employment, verbatim evidence and two preserved analysis versions.
- Browser profile check: created `Synthetic teaching validation`, recorded experience separately from aspirations, added year-level coordinator/primary teacher variants and a school-leadership keyword. Shared hard Melbourne location overridden by track-specific soft Victoria. Draft review showed the effective override and undecided dimensions; explicit approval activated revision1. This demonstrates generic professions, not a personalised owner profile.

## Review UI

Desktop and 390px mobile inspection: compact full-width table, source/role/company/location/date, filter and sortable headings, horizontally scrolling table confined to container. Selecting a row opens native modal. Escape closes it and restores focus to the originating job control. Mobile modal fits viewport. Source strings and raw listing text render as text.

The final rich workspace was subsequently checked on desktop/mobile: comparison columns include compensation/provenance/units, independent fit/confidence/review/application/availability, saved/applied dates, source freshness, filters, named views and column persistence. Role cells stay sticky during horizontal scrolling; long employment summaries are compact while dates remain visible. Full values and history remain in the modal.

## Baseline and limits

Owner reports current research takes 1–2 hours/session. A bounded two-listing source capture was subsequently timed at about 2.61 minutes; it excludes later interpretation/review and development work. This is not a comparable personal useful-batch session, so no time-saving claim or percentage is justified. Deterministic fixtures remain separate from the observed Codex judgements and do not establish universal site/model support. Native Mac archive checks are detailed below; fresh OS/Gatekeeper and other platforms remain unverified.

## Bounded multi-track source run

Run `8f8439dc-4384-4866-a467-2e7db1ed9964`, approved synthetic profile v3, selected Teaching/Baking, SEEK/LinkedIn, maximum two new jobs, AUD1 cap. The app planned four approved source/track searches. Two were deliberately left pending when the run was stopped after two captures; this is incomplete coverage, not no suitable jobs. Four conservative AUD0.05 reservations preceded browser work. Actual host costs were unavailable, so AUD0.20 remains estimated, never reported as free or billed actual.

- SEEK visibly showed Primary teacher/All Melbourne VIC. Opened [Primary School Teacher, Leibler Yavneh College](https://au.seek.com/job/95249271). Original readable narrative and employer careers destination were saved before analysis as job `ac95a1e8-1056-482e-8f26-f391024e3251`. Analysis `e97b651b-7025-43c6-8e50-767960857996` preserves the one-year full/part-time contract and flags secondary-trained wording in a primary advert for clarification. No numeric pay or unstated work arrangement was invented.
- LinkedIn's Baker/Melbourne URL visibly broadened to Australia. The visible Location control was corrected to Greater Melbourne Area (16 results), then the [Woolworths Baker listing](https://www.linkedin.com/jobs/view/4476714066/) was captured as job `1f8f8a40-478e-4a92-825d-fa1acac978d6`. The observed employer apply destination was saved without clicking it or retaining LinkedIn tracking tokens. Analysis `d3751496-6366-4515-a17e-a0143e0ef639` preserves qualification/experience requirements, employer-attributed benefits, onsite header and the full-time/alternative-roster uncertainty.
- Separate bounded cached review batches used conservative estimates and actualCost null. Both listings remained investigate with low confidence: the synthetic search profile contains no candidate qualifications or concrete working preferences. Grounded follow-up questions were useful findings; these are not personal job recommendations.
- No challenge was encountered in the live browsing. Same-session human sign-in/verification, expiration and blocked/unsupported/zero distinctions are covered by controlled tests, not falsely reported as fresh live login proof. No website password, message or application was submitted.

## Onboarding, feedback, reassessment and tracking

Browser imported a synthetic nursing resume, visibly removed its name/email/phone by default, then required review of the exact analysis payload `2e1f3d8d-aa41-491f-b105-15d16657d21d`. Codex read only that reviewed payload and submitted extractive experience/possible community-nursing directions; it did not infer aspirations. The browser explicitly chose a direction, entered a separate synthetic aspiration, created linked draft v5 and approved it separately. All facts and contacts were synthetic.

The restrictive synthetic school job `46b93aee-2a84-46dd-8d57-ecd81248787d` was explicitly saved with optional feedback. A pending proposal displayed hard→soft decision authority, supporting feedback and a review checkbox. Explicit acceptance created profile v4. Cached batch `80a8cee1-ea98-4b6e-b472-6979f2ba6d5c` supplied unchanged saved evidence to Codex; new reasoning retained the approval-layer concern and explained why it was now a tradeoff instead of a hard exclusion. History retained excluded/v2 and promising/v4; personal review stayed saved. A clearly labelled synthetic interview tracker event was recorded in the UI; no actual interview or application occurred.

Sparse diagnosis `2c7ba9b6-62a1-499b-97e7-6fbdb7f8f4c8` reported 2/4 successful searches, incomplete approved coverage and zero confirmed conflicts under that run's profile. It offered keyword proposals separately from requirement changes and identified cached jobs first. No requirement was automatically weakened.

## Archive and recovery acceptance

Exact Node26.12.0 on native macOS27.0.1 arm64. A real archive was extracted to an independent folder with spaces and run under a sandbox denying non-loopback networking, with Node/npm/mise/Git/compiler absent from PATH. Bundled runtime/local assets launched offline. Tests verified evidence save/restart, repeated launch, corrupted-package retry, keep-data uninstall/reinstall, additive populated-data upgrade, rejected malformed migration/downgrade, and explicit owned-data removal. An independent controlled migration committed a synthetic write and then failed; snapshot recovery restored the original evidence and previous active release. Temporary upgrade snapshots/probes are cleaned and normal old releases bounded. Full Node notices and build dependency licenses/provenance are packaged.

This is an isolated installation on the maintainer's Mac, not a fresh OS image or clean-machine Finder/Gatekeeper/notarization proof. Windows/Linux/Intel Mac/Chromebook and optional host installation remain unverified. Private backups include original resumes and evidence; credentials/browser-session directories are excluded. Final standards/spec reviews found three issues and all were fixed with regression checks; see review-spec-1.md.
