T4: Build an approved profile from a resume

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Import resume content and use it to propose a profile and career directions that the user reviews before activation.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Provide resume text import at minimum and document supported file formats; unsupported files receive a clear fallback rather than partial silent ingestion.
- [ ] Remove contact details from the cloud analysis payload by default and let the user review the extracted content being analysed.
- [ ] Suggest demonstrated experience, possible career tracks and keyword variants without inventing achievements or treating past work as a desired future direction.
- [ ] Gather missing aspirations and working preferences through a short review flow; distinguish unknown values.
- [ ] Allow editing and explicit approval of suggestions into a versioned Preference Profile; preserve the source-to-suggestion relationship.
- [ ] Test payload redaction with synthetic resumes, model failure recovery and the approved-versus-draft boundary.
