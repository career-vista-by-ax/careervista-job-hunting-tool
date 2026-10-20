# Spec #1 implementation status

Integration branch: `integration/spec-1`. Review: https://github.com/career-vista-by-ax/careervista-job-hunting-tool/pull/23. All feature slices #2–#21 are integrated. #22 includes native Mac arm64 packaging, isolated offline installation, populated-data upgrades/rollback, repeat launch, keep-data reinstall and explicit owned-data removal. The PR closes #1–#22 when merged; no ticket is closed merely because code was drafted.

The product supports any profession and arbitrary user-approved tracks. It is model/agent independent; Codex is the development/browser validation host. Daily review is a rich full-width table with filters, saved views, column choices and modal details. User review, agent fit, application progress and source availability have separate histories.

## Verification

- Exact pinned Node 26.12.0; TypeScript check/build and 80 behavioral checks through public application/HTTP/lifecycle interfaces. Tests use isolated roots and deterministic inputs; the archive test also invokes the real bundled runtime and launcher with no development tools on PATH and non-loopback networking denied.
- Real supervised SEEK teaching and LinkedIn baking discovery/capture, approved multi-track run, saved destinations, grounded extraction, explicit unknowns and conservative Codex fit review. LinkedIn's broadened location was detected and corrected using its visible control.
- Browser-verified synthetic resume import/redaction/payload review, grounded suggestions, separate aspirations, draft/approval, explicit save feedback and preference proposal, cached reassessment restoring eligibility while retaining old exclusion and independent review, synthetic application event and sparse-run diagnosis.
- Standards and Spec reviews found three grouping/reversal issues. All were fixed in one implementer branch with regression coverage, then independently rechecked: grouped destinations, extraction source ownership and reassessment evidence-scope drift.
- Detailed evidence and limits: [validation record](validation-2026-10-18.md), [review record](review-spec-1.md), [release instructions](release.md).

## Verification limits

Native execution is verified on the maintainer's macOS 27.0.1 arm64 with isolated installation roots, not a fresh OS image. Gatekeeper/quarantine/notarization and other platforms remain unverified and are not advertised as supported. The external browser-capable host is optional and separately installed/licensed; no website password, CAPTCHA bypass or host account is provided by the app. Actual fresh website-login challenges were not encountered in the live checks; pause/resume behavior is tested with controlled responses.

The owner reports a 1–2 hour research baseline. The bounded two-listing capture took about 2.61 minutes, excluding subsequent interpretation/review and development work. These workloads are not comparable enough for a time-saving percentage or a claim of worthwhile personal matches. Profiles/resume and application events used in validation are synthetic; no owner resume, real application submission or recruiter message was used.

## Scoped cleanup

Use the owner's mac-deep-clean dry-run/inspect/apply method only on completed CareerVista worktrees and owned temporary build/cache output. Preserve canonical source, branches, reusable dependencies/runtime, release artifacts and validation evidence. The broad machine-specific script's DRE/global-cache/Time Machine operations are excluded. Final scoped cleanup removed 21 integrated worktrees and superseded preview artifacts, reclaiming 491.68 MiB; measurements are recorded in the validation record.
