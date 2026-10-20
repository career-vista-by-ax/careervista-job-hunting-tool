# Self-contained Mac and Windows archives

Extract `CareerVista-<version>-macos-arm64.tar.gz` and double-click **CareerVista.command**. It installs under `~/Library/Application Support/CareerVista`, starts the app and opens the exact localhost URL in your normal browser. No application account, Node, mise, package manager, compiler, Git, Docker or internet download is needed for local review. Keep the extracted folder as your launcher and uninstall tool. Downloads/archives are separate copies outside the owned installation root.

The archive includes the native Node 26.12.0 executable with built-in SQLite, complete Node LICENSE/third-party notices, compiled application/UI/migrations, original versioned skills, relevant user documentation, dependency notices and build provenance. Build-tool node_modules, user data, credentials, browser sessions, caches and unrelated project files are not shipped. The normal browser and optional agent host remain external. This release grants no public distribution/license permission for the original application.

## Launch and removal

From Terminal in the extracted folder:

```sh
./CareerVista.command --no-browser
./CareerVista.command status
./CareerVista.command stop
./CareerVista.command storage
./CareerVista.command clear-cache
./CareerVista.command uninstall
./CareerVista.command install
./CareerVista.command upgrade
./CareerVista.command launch --no-browser
./CareerVista.command uninstall --remove-data --confirm REMOVE_OWNED_DATA
```

No command needs administrator access. `--root /absolute/path` selects a separate installation; each friend uses an independent root, database, provider settings and host session. Uninstall keeps `data/`, `credentials/` and `sessions/` by default, including resumes and evidence. Reinstall reuses them. Explicit removal deletes these owned persistent directories and unchanged packaged resources, preserving unknown/modified files, external exports/backups and the extracted download. A small ownership stub in `state/installation.json` remains for safe attribution/retry; this is not a claim that the installation root is completely removed. No shortcut or OS background service is installed. All unavoidable optional skill registrations are owned and recorded by the shared lifecycle.

Repeated open reuses the authenticated instance. Stop never trusts a stored PID. Checksum failures leave the current release active; retry with an intact package. Locks and interrupted-stage handling are documented in the lifecycle contract. A stale lifecycle lock requires inspection before retry rather than automatically killing a process. A different release over a populated database first snapshots the closed owned database and tests the incoming migrations on a private copy. Only unchanged applied migrations plus additive migrations are accepted. Actual migration failure restores the snapshot and keeps the previous release active. Downgrades/rewritten applied migrations are refused. At most the active and previous unchanged release are retained; modified older files remain reported. See lifecycle-contract.md for interrupted-upgrade recovery.

## Explicit upgrade

From the newly downloaded and extracted release folder, use `./CareerVista.command upgrade` on Mac or `.\CareerVista.cmd upgrade` on Windows. This installs the bundled version if it differs from the active version, preserves persistent records, validates forward migrations using the existing snapshot/recovery path, and launches/opens the updated app. `--no-browser` prints the URL; a custom installation needs its original `--root` argument. Repeating upgrade from the same release reuses the running app. No release download is performed by this command. Keep the new folder as your launcher; running an older bundle is not a rollback mechanism.

## Optional agent setup

The first screen and offline review work without an agent. For research, separately install a compatible browser-capable host. Development validation uses Codex desktop with its Chrome browser-control extension. Configure the model/provider in that host's settings; host licensing, account, credentials, platform requirements and persistent browser-session behavior belong to the host and are not bundled guarantees.

After local install, run `./CareerVista.command register-skills --host codex` (or `--host agents` for a compatible filesystem-skills host). It registers only `careervista-<installation UUID>` under that host's skills directory, records owned content hashes and refuses conflicts. Reload skills using the host's documented mechanism and provide the running localhost URL. Website sign-in is performed directly by the user on the website in the controlled session. The app/skills must never request website passwords. The app itself has no account login. Modified registered files are preserved/reported during uninstall.

## Build and provenance

Use mise's committed runtime pin and exact lockfile for development. On a native Apple Silicon Mac with build dependencies already installed:

```sh
mise exec -- node scripts/package-release.mjs --runtime-root /absolute/path/to/node/26.12.0 --output /absolute/output
```

The default builder freshly compiles source into an operation-owned temporary directory and cleans it on completion/failure; it never packages a stale dist folder. It refuses existing artifact names and preserves earlier output. Explicit `--version` creates a distinct version; default is `0.1.0-<source revision>`. `--dist` is an explicit prepared-asset override for acceptance/controlled builds. The builder checks the supplied runtime's version/platform/architecture and rejects non-system dynamic libraries, symlinks, missing assets and incomplete Node notices. Only macOS arm64 output is supported by this builder.

`release.json` hashes every installed file; `archiveFiles` hashes the two outer launcher/readme files. The `.tar.gz.sha256` sidecar hashes the entire archive, including its manifest. Verify the sidecar before extraction using `shasum -a 256 <archive>`. Hashes detect corruption, not a maliciously replaced archive plus sidecar. `licenses/provenance.json` records source revision, dirty status, exact Node/binary/license hashes, external system libraries, build lock hash and target. The source runtime is the existing mise-managed installation. Upstream release identity was checked against the official release page; an independent upstream archive checksum could not be retrieved in this session and is explicitly marked **not verified**, never implied by the local binary hash. Retain the source runtime/lock/provenance for repeatability. No latest-version resolution occurs at user launch.

## Observed acceptance and limits

On 2026-10-18, macOS 27.0.1 arm64, Node 26.12.0, automated acceptance creates/extracts a real archive into a folder with spaces. The extracted launcher runs with PATH excluding Node/npm/mise/Git/compiler and under a macOS sandbox denying all non-loopback networking. A direct external HTTP request is verified to fail with EPERM/EACCES, while the local HTTP UI/assets and evidence interface work. The test saves evidence, repeats launch, restarts/reviews it, rejects a corrupted package without replacing the install, retries install, uninstalls keeping data, reinstalls/reviews retained evidence, upgrades a populated database with an additive migration, rejects a broken migration/downgrade while retaining data, then explicitly removes owned data/resources. A separate controlled migration writes to the owned database before failing and verifies snapshot rollback. Disposable storage stays at zero through these repeated sessions; lifecycle tests separately verify bounded cache cleanup and protected sessions/credentials.

This is an isolated installation on the maintainer's native Mac, **not a fresh OS image**. It does not establish all minimum supported macOS versions, real download/quarantine, Gatekeeper/notarization, Finder double-click launch on a clean machine, optional host installation, model quality or complete real-source workflows. No global security setting is changed or quarantine removed automatically. The archive is not notarized. Windows, Linux, Intel Mac and Chromebook archives/host workflows remain unverified and are not advertised as supported. Parent workflow evaluation tracks real model/source checks and baseline comparison separately.


## Windows x64 preview

Build natively on Windows x64 with the pinned Node 26.12.0 runtime and `node scripts/package-release.mjs`. The same packager emits a ZIP containing `CareerVista.cmd`, `runtime/node.exe`, full licenses, compiled app, agent skills and documentation. It uses Windows's built-in tar for ZIP packaging/extraction. The Windows launcher opens the default browser with the OS PowerShell `Start-Process` facility; there is no policy bypass or global configuration change.

Extract All before opening `CareerVista.cmd`. Default data root: `%LOCALAPPDATA%\CareerVista`. PowerShell examples: `.\CareerVista.cmd --no-browser`, `.\CareerVista.cmd stop`, `.\CareerVista.cmd register-skills --host codex`, `.\CareerVista.cmd uninstall`. Use the same explicit confirmation for permanent owned-data removal. Administrator access, WSL and a separate Node installation are unnecessary. No Windows service is installed.

`.github/workflows/windows.yml` builds and tests on a native Windows x64 runner, including the actual CMD wrapper with spaces in paths and no developer tools on PATH, local HTTP, persistent records, forward migration, shutdown and removal. Successful runs upload the ZIP and SHA-256 as private build artifacts. This is automated runner coverage, not a fresh consumer Windows installation or a Windows browser-agent validation. The preview is unsigned; Explorer/SmartScreen and Windows ARM64 remain unverified. Use a compatible external agent host on Windows; no Mac host capability is assumed portable.

Each computer has its own database and host configuration. Transfer records using private JSON backup/restore into an empty installation; copy referenced external documents separately. Avoid syncing an open SQLite file between machines.

## Reset without reinstalling

Open **Local data → Reset all data** in the web interface. Review the scope and select **Confirm scope and continue**, then type `DELETE` exactly and select **Erase all data**. Cancel or close at either stage to leave saved data intact. The final action removes all relational career data (including profiles, resumes and variants, runs, saved views and application history) and clears the contents of the app-owned credentials, sessions, cache, logs and temp directories. Software, migration history, skill registration and the running localhost app remain available. External backups/exports, original documents and host browser profiles remain separate.

Pause external research first. A confirmation expires after five minutes, is single-use, is invalidated by saved-data writes and cannot survive app restart. Database deletion is transactional. If ancillary file cleanup fails after the database commits, the interface reports the uncleared folders and offers a new confirmed reset to retry. Reset is logical deletion, not a forensic disk-erasure guarantee.

## Search-history and application release

The next release adds migrations 022–023 for search archives, recoverable deletion/source suppression, per-stage application answers/contact snapshots, exact local document copies, language preference and bilingual assessment translations. Backups include these records; reset clears them. Old backups remain readable with their original schemas. App-owned copies are limited to 5 MiB per file and 50 MiB total and always download as attachments.

Optional native skill registration installs capture, careervista-job-search, ax-cv and ax-30-secs with installation ownership receipts. The shortcut's installation.json records its absolute bundled runtime, root, installation identity and capture-skill path. Its launch helper verifies the active runtime/lifecycle checksums, authenticates launch/reuse and returns the current localhost URL. Updates refresh unchanged owned skill content and paths; edited files are preserved and reported. This is the existing explicit local-package upgrade path, not an automatic release downloader.

The skills can also be installed independently using a host installer or the
skills CLI; see the README. The standalone search skill asks Docker versus
local copy, obtains permission for Docker actions and discovers the actual
connection. Its source/API guides are served by the app, so a Docker user does
not need a native installation or local capture-skill path. Exact invocation
syntax and document/browser capabilities depend on the agent host.

## Docker preview

Build using the repository Dockerfile or Compose configuration. No public image
is advertised until an image has actually been published. The runtime uses a
non-root user, loopback-only host port publishing and a persistent named volume.
Host browser profiles, home directories and the Docker socket are not mounted.
The container listener accepts only the configured HTTP loopback public origin;
if changing the host port, set `CAREERVISTA_PUBLIC_ORIGIN` to that exact address.

An OS-managed SQLite lock outside the workspace prevents two containers from
using the same volume concurrently. Image replacement runs the same validated,
snapshot-backed installation/migration path as native releases. Keep the volume
when replacing the image. Deleting it is permanent data removal, not an update.
Skills and host document/default-browser tools stay outside the container. The image bundles pinned Playwright and Chromium headless shell for public JavaScript pages, available through `docker exec` without a local Playwright install or extra listening port. See `collection` Headless-first access for batch input, compact output, content validation and access-barrier fallback. Host search tools/public APIs remain the first discovery step; headless reads cannot guarantee access to bot-protected boards.
