# Self-contained Mac archive

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
./CareerVista.command launch --no-browser
./CareerVista.command uninstall --remove-data --confirm REMOVE_OWNED_DATA
```

No command needs administrator access. `--root /absolute/path` selects a separate installation; each friend uses an independent root, database, provider settings and host session. Uninstall keeps `data/`, `credentials/` and `sessions/` by default, including resumes and evidence. Reinstall reuses them. Explicit removal deletes these owned persistent directories and unchanged packaged resources, preserving unknown/modified files, external exports/backups and the extracted download. A small ownership stub in `state/installation.json` remains for safe attribution/retry; this is not a claim that the installation root is completely removed. No shortcut or OS background service is installed. All unavoidable optional skill registrations are owned and recorded by the shared lifecycle.

Repeated open reuses the authenticated instance. Stop never trusts a stored PID. Checksum failures leave the current release active; retry with an intact package. Locks and interrupted-stage handling are documented in the lifecycle contract. A stale lifecycle lock requires inspection before retry rather than automatically killing a process. A different release over a populated database is deliberately refused until a verified backup/schema migration plan exists; this archive does not claim safe general upgrades or downgrades.

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

On 2026-10-18, macOS 27.0.1 arm64, Node 26.12.0, automated acceptance creates/extracts a real archive into a folder with spaces. The extracted launcher runs with PATH excluding Node/npm/mise/Git/compiler and under a macOS sandbox denying all non-loopback networking. A direct external HTTP request is verified to fail with EPERM/EACCES, while the local HTTP UI/assets and evidence interface work. The test saves evidence, repeats launch, restarts/reviews it, rejects a corrupted package without replacing the install, retries install, uninstalls keeping data, reinstalls/reviews retained evidence, then explicitly removes owned data/resources. Disposable storage stays at zero through these repeated sessions; lifecycle tests separately verify bounded cache cleanup and protected sessions/credentials.

This is an isolated installation on the maintainer's native Mac, **not a fresh OS image**. It does not establish all minimum supported macOS versions, real download/quarantine, Gatekeeper/notarization, Finder double-click launch on a clean machine, optional host installation, model quality or complete real-source workflows. No global security setting is changed or quarantine removed automatically. The archive is not notarized. Windows, Linux, Intel Mac and Chromebook archives/host workflows remain unverified and are not advertised as supported. Parent workflow evaluation tracks real model/source checks and baseline comparison separately.
