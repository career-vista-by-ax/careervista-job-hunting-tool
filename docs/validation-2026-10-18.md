# Development acceptance evidence — 2026-10-18

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

Desktop and390px mobile inspection: compact full-width table, source/role/company/location/date, filter and sortable headings, horizontally scrolling table confined to container. Selecting a row opens native modal. Escape closes it and restores focus to the originating job control. Mobile modal fits viewport. Source strings and raw listing text render as text.

The richer table requested after comparing JobSync is still being completed with domain tickets; this first UI check is not full daily-workspace acceptance.

## Baseline and limits

Owner reports current research takes1–2hours/session. No comparable timed CareerVista session has been measured; no time-saving claim is justified. Current source checks prove actual capture-to-extraction/review, not all multi-track bounded runs, all page layouts, fresh website login recovery or every platform. Deterministic source/model fixtures are separate evidence and cannot establish real-model judgement quality or site access guarantees. Full Mac release packaging/installation and other platform status remain explicitly pending.
