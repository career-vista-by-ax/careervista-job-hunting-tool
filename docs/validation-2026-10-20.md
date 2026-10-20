# Local preview acceptance — 2026-10-20

Validated on the maintainer's macOS arm64 host with pinned Node 26.12.0.
Preview version: `0.2.0-preview.1`. These are local artifacts, not a GitHub or
registry publication. Source provenance records uncommitted changes.

- TypeScript check and whitespace checks passed. Final suite: 101 tests,
  100 passed, 1 Windows-only test skipped, 0 failures.
- The actual macOS archive checksum was verified, extracted into a path with
  spaces and used to upgrade an isolated populated prior installation. Evidence,
  profiles, resume and application history were preserved. Repeating upgrade
  reused the running instance.
- Updated the existing local installation from
  `0.1.0-20261020-search-workflow.1` to the preview. All 52 tables preserved their
  existing rows/columns. Repeating upgrade reused the same running instance.
  This is a downloaded-package upgrade, not automatic release downloading.
- Built and ran a local Docker image with an isolated labelled named volume,
  non-root user, dropped capabilities, read-only root filesystem and a loopback
  port mapping different from the internal port. Replaced the previous image
  using that same populated volume. All 52 tables, contacts, answers, reminders
  and the exact saved CV bytes survived. The health check passed. A second
  container was refused concurrent access to the same volume.
- HTTP checks reject unexpected Host/Origin values, require an explicit loopback
  public origin for a container listener, and retrieve the portable capture,
  source, CV and 30-second-review guides.
- Independently installed the three portable skills using skills CLI 1.7.4 into
  isolated Codex and Claude Code project directories, without installing an app
  runtime. Skill-format validation passed for all three. This demonstrates those
  installation paths, not every agent's capabilities or end-to-end performance.
- Browser inspection verified the coloured fit legend and the original-advert
  application link alongside document preparation and manual tracking controls.
  Temporary test tabs, installations, processes and labelled Docker resources
  were removed; the updated user installation remains running.

No applications or messages were sent. No image was pushed and no GitHub release
was published. No licence was selected. Clean-machine Gatekeeper, notarization,
Windows consumer use and every possible agent host remain unverified.
