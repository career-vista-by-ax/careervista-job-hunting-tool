T6: Compare compensation without hiding assumptions

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Review compensation facts, reports and estimates without confusing their sources or units.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Store and display advertised amounts, external reports, model estimates and user adjustments as separately attributed records.
- [ ] Preserve currency, period, base pay, total package, superannuation treatment and contract-rate units when available.
- [ ] Keep original figures and evidence visible when the user applies an adjustment; never overwrite source facts.
- [ ] Show unknown components and uncertainty; estimates cannot appear as advertised commitments.
- [ ] Do not silently annualise contract rates or convert currencies/packages with unstated assumptions.
- [ ] Test mixed units, uncertain superannuation, absent pay and adjustments through the public interface and UI.
