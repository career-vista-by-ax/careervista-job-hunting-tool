T12: Explore an additional source under supervision

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Add an unfamiliar source and learn its usable collection workflow without claiming universal support.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Let the user add a source URL and approve a supervised exploratory run using the current tracks and limits.
- [ ] Record observed source capabilities, required human steps, supported fields and known limitations.
- [ ] Save successfully collected evidence through the same public ingestion interface and show the result in the job view.
- [ ] Expose unsupported or failed exploration distinctly from zero results and provide paste/manual entry fallback.
- [ ] Only retain a reusable source workflow after review; protect the agent from instructions embedded in captured pages.
- [ ] Test successful partial exploration, user pauses and unsupported layouts with controlled responses; document that arbitrary URLs do not guarantee collection.
