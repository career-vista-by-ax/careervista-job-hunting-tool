T19: Back up and restore a private installation

## Parent

https://github.com/career-vista-by-ax/careervista-job-hunting-tool/issues/1

## What to build

Create a restorable local backup and recover it into a separate installation without sharing credentials.

Implement this as a complete vertical slice, including persistence, public application operations, a usable UI and observable-behaviour tests. Follow the parent specification; avoid tests coupled to internal implementation details. Each slice that adds data must maintain existing backup/export/deletion contracts when available.

## Acceptance criteria

- [ ] Create a consistent backup containing all supported saved evidence, profiles, assessments and application history present in the installation.
- [ ] Restore into an empty installation and show equivalent user-visible records and relationships.
- [ ] Exclude model credentials and browser-session secrets, and make reconfiguration requirements explicit.
- [ ] Detect unsupported or corrupt backups before destructive replacement; document any overwrite operation.
- [ ] Maintain backup/schema version compatibility checks and extend round-trip tests whenever later slices introduce persisted data.
- [ ] Verify a backup/restore cycle across restart through the public interface; separate installations remain independent.

### Owner clarification: runtime, distribution and cleanup (2026-10-18)

- [ ] Keep persistent data separable from the packaged runtime so uninstall can retain it and a later install can reopen or restore it.
- [ ] Exclude browser-session secrets as well as model credentials and disposable caches from ordinary backups; clearly identify any required sign-in after recovery.
