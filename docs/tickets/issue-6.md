T5: Assess fit with evidence and uncertainty

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Explain whether a saved job fits the user's skills, working preferences and constraints, while preserving every assessed candidate.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Assess qualifications, working preferences and practical constraints separately and show confidence independently from fit.
- [ ] Produce explained fit labels, reasons to pursue, concerns and investigation questions linked to saved evidence and a Preference Profile version.
- [ ] Confirmed hard-requirement conflicts prevent a strong-fit label; absent salary or remote information remains unknown unless disclosure is itself required.
- [ ] Keep employer claims, external reports and model inference distinct; company size alone never establishes a culture judgement.
- [ ] Retain excluded jobs with reasons and make them retrievable; assessment never changes the user's review decision or application state.
- [ ] Test through the public interface with controlled outputs and curate evaluation cases including a restrictive startup and an autonomous larger-company team; record real-model evaluation context without asserting exact prose.
