# Release/lifecycle bundle contract v1

The installed release payload contains only the files named in `release.json`’s `files` map. The downloadable archive also carries `CareerVista.command` and `README.txt`, which are transport/launcher copies outside the installation root. Their SHA-256 hashes are in `archiveFiles`; the lifecycle does not install them. The archive sidecar hashes the entire compressed archive, including the manifest. Example:

```json
{
  "format": "careervista-release",
  "version": "0.1.0",
  "nodeVersion": "26.12.0",
  "runtime": "runtime/node",
  "entry": "app/dist/main.js",
  "files": {
    "runtime/node": "SHA256_HEX",
    "runtime/LICENSE": "SHA256_HEX",
    "app/dist/main.js": "SHA256_HEX",
    "app/dist/lifecycle.js": "SHA256_HEX"
  }
}
```

Windows uses runtime/node.exe. Include every compiled app module, migration and local public asset under app/dist/, and owned versioned skills under agent-skills/. LICENSE/third-party notices may live under runtime/ and licenses/. All paths must be relative filename components, no traversal, absolute paths or symlinks. Every mapped file requires a SHA-256 hash. Unknown unlisted files are not installed. Runtime and entry must exist in the files map. Include runtime/LICENSE and app/dist/lifecycle.js. Packager must mark Unix runtime/node executable; installation preserves modes.

Invoke the bundled runtime with the shared lifecycle module (no npm/mise/git at runtime):

```
runtime/node app/dist/lifecycle.js install --root /absolute/installation --bundle /absolute/extracted-release
runtime/node app/dist/lifecycle.js launch --root /absolute/installation
runtime/node app/dist/lifecycle.js status --root /absolute/installation
runtime/node app/dist/lifecycle.js stop --root /absolute/installation
runtime/node app/dist/lifecycle.js storage --root /absolute/installation
runtime/node app/dist/lifecycle.js clear-cache --root /absolute/installation
runtime/node app/dist/lifecycle.js uninstall --root /absolute/installation
runtime/node app/dist/lifecycle.js uninstall --root /absolute/installation --remove-data --confirm REMOVE_OWNED_DATA
```

Install creates releases/<version>/ and state/installation.json with ownership UUID, canonical root and active release. Keep-data uninstall is default: removes owned packaged release files and disposable cache/log/temp, retains data/credentials/sessions plus ownership metadata for reinstall. Explicit remove-data also removes the three persistent namespaces; pre-existing external backup/export copies remain. Unknown files and modified owned package files are retained and reported. Normal browser profiles, shared runtimes/package managers, other projects and unrelated host skills are outside scope.

Launch starts releases/<active>/runtime/node with releases/<active>/app/dist/main.js and CAREERVISTA_ROOT. Main must expose nonce-authenticated control status/shutdown when lifecycle environment variables are present. Runtime state belongs in state/process.json and never enters backups/exports. PID is informational; shutdown authenticates installation and instance IDs with the nonce over exact loopback origin and never kills an arbitrary stored PID. Ambiguous process ownership blocks destructive lifecycle operations.

Install validates hashes before switching the active manifest, uses owned staging and a lock, and preserves the previous active release on failure. Runtime upgrades have no automatic database downgrade; an older runtime must never be activated after migrations without a compatible database recovery. Platform execution validation belongs to release ticket #22.
