T2: Capture and structure a listing through the agent

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Use a separate browser-capable agent to submit one captured listing and produce reviewable structured details through a configurable cloud model.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Document and exercise a versioned agent-facing application interface; the agent does not modify SQLite directly.
- [ ] Persist source evidence before model analysis and extract title, company, requirements, benefits, location, work arrangement and employment details with evidence references.
- [ ] Expose extracted information for review and correction while preserving original evidence; distinguish missing information from negative facts.
- [ ] Provide configurable model/provider settings, protect credentials from display/logging, and record available model and analysis-version metadata.
- [ ] Malformed model output, provider failures and duplicate agent submissions leave saved evidence intact and expose actionable errors.
- [ ] Validate a supervised browser capture through to the UI; select and document the agent host and interface transport based on this slice.
- [ ] Automated public-interface tests use controlled browser/model responses; no unrelated personal notes are sent to a provider by default.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Package versioned browser-agent skills with an explicit install/uninstall registration flow; keep an ownership manifest and preserve other skills. If a separate host setup step is unavoidable, expose it clearly and keep manual/offline app use working.
- [ ] Open website authentication in the agent-controlled browser, pause for the user to sign in directly, and resume the same session. Never solicit or log website passwords; distinguish app account-free operation from user-managed site access.
- [ ] Disclose agent-host packaging, platform, network and licensing requirements before claiming self-contained browser assistance; preserve supported sessions separately from disposable caches.
