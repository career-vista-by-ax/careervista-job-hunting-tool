T21: Verify self-contained releases and the complete research workflow

## Parent

https://github.com/allenhori/careervista-job-hunting-tool/issues/1

## What to build

Validate installation and the complete supervised first-release workflow on Mac, including recovery and honest support documentation.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Demonstrate a fresh Mac installation, model/agent configuration, resume-profile approval and multi-track research using the documented setup.
- [ ] Run supervised capture-to-review checks for both advertised initial sources and record limitations; inability to validate a source must not become an unsupported success claim.
- [ ] Exercise evidence review, fit explanations, feedback, reassessment, application tracking, restart, offline access and backup recovery.
- [ ] Evaluate representative real-model outputs for grounding, unknowns and preference sensitivity, recording the model/configuration and separating this from deterministic fixture tests.
- [ ] Compare a real session with the owner's existing workflow using an explicit baseline; record observed effort and useful findings without inventing a time-saving target.
- [ ] Document Mac verification and unverified Windows/Linux/Chromebook dependencies, separate-installation sharing, and reference/dependency-license records.
- [ ] Verify single-user localhost operation and ensure first-release delivery does not introduce automatic applications, document generation or public hosting; earlier tickets retain responsibility for their own acceptance tests.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Publish downloadable self-contained archives per supported Windows/Linux/macOS OS and architecture with compiled assets, tested Node runtime, required production/native dependencies, bundled skills and an obvious launcher/install flow. Docker is optional and must not be required.
- [ ] Use shared TypeScript lifecycle logic with minimal OS launchers; no user-installed Node, mise, package manager, compiler or Git is required. Use mise to pin the build runtime, stable dependency locks and recorded runtime/dependency licenses.
- [ ] Test on clean supported targets: offline first local launch, install retry/rollback, repeated launches, upgrade, uninstall keeping data, reinstall with retained data, and uninstall removing owned data. Distinguish core-app platform verification from browser-agent host verification.
- [ ] Present any unavoidable agent-host/secondary skills setup plainly; no app account or hosted sign-in is allowed. Site authentication is performed by the user in the agent browser, followed by resume.
- [ ] Measure cache/temp/log growth through repeated and interrupted sessions/installations, enforce documented caps, and verify cleanup preserves evidence and persistent sessions.
- [ ] At the end of implementation use the owner deep-clean workflow in a scoped dry-run-first manner and report results; do not run its unrelated DRE/global-cache/Time Machine operations as part of this project.
