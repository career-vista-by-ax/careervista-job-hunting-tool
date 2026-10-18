# CareerVista

A private, single-user job research workspace. Save any kind of job listing and read its original evidence later, including offline. Each person uses a separate installation and database. No application account, model key, or agent is needed for local review.

## Self-contained Mac archive

The native Apple Silicon archive includes Node, SQLite, compiled local assets and versioned skills. Extract it and double-click **CareerVista.command** to install/launch privately without development tools or an application account. Optional browser-agent setup remains separate. See [release instructions and verified limitations](docs/release.md). Windows, Linux, Intel Mac and Chromebook release support remains unverified.

## Mac development launch

This is the source/developer workflow. End-user archive instructions are above; these commands are for contributors.

1. Install [mise](https://mise.jdx.dev/getting-started.html), then run `mise trust` and `mise install` in this repository.
2. Run `mise exec -- npm ci` and `mise exec -- npm run build`.
3. Run `mise exec -- npm start` and open [CareerVista](http://127.0.0.1:4318).
4. Choose **Save a listing**, enter the source URL and basic details, and paste the readable listing text. Choose its title in the table to read the evidence. Open **Profile & search tracks** to create, review and explicitly approve your search preferences; see [profile help](docs/profiles.md).
5. Stop with Control+C. Start again to review stored records. After the build, launching and reviewing needs no network access or agent.

The server binds exclusively to `127.0.0.1`; it rejects unexpected Host headers, foreign origins and cross-site browser requests. Open the exact address printed at launch. This is a local, single-user interface, not a remotely hosted service. Other processes running as your user can access it.

Set `CAREERVISTA_ROOT` to choose an independent root; set `CAREERVISTA_PORT` if 4318 is occupied (0 selects a free port). Default Mac root: `~/Library/Application Support/CareerVista`.

| Directory | Ownership and purpose |
| --- | --- |
| `releases/`, `state/` | Owned versioned runtime/application and lifecycle manifests |
| `data/` | Persistent SQLite database and its live SQLite journals |
| `cache/` | Capped disposable run caches |
| `temp/` | Disposable run files and isolated upgrade probes |
| `logs/` | Capped disposable run logs; launch messages go to terminal |
| `sessions/` | Persistent supported agent browser sessions; currently unused |
| `credentials/` | Persistent optional provider credentials; currently unused |

Never remove `data`, `sessions`, or `credentials` as cache cleanup. Do not manually delete live SQLite WAL/journal files. The app makes no runtime downloads. Disposable storage has size/age caps; upgrade probes and build staging are cleaned on completion or recovery.

## Agent-assisted extraction

Any compatible agent can submit evidence-linked structured details through the [version 1 interface](docs/agent-interface.md). The agent host owns model/provider configuration; CareerVista requires no provider key. The job modal shows details, unknowns, source quotes and correction history. The packaged capture skill and explicit registration/removal command are documented in that guide. Codex is the development validation host; no bundled browser/runtime claim is made.

## Bounded research runs

Open **Research runs** to choose approved tracks, configurable sources, a new-job limit (25 suggested), and a spending cap. Your agent receives the saved run and uses its [version 1 interface](docs/runs.md) to obtain work authorizations, reserve model estimates, persist progress and pause for user sign-in or verification. You can stop, resume or cancel while retaining partial evidence. Budget reports distinguish known costs from estimates; they do not meter unrelated agent-host spending.

## Development checks

`mise exec -- node --test tests/*.test.ts` runs behavioral tests through the public application and HTTP interfaces. `mise exec -- npm run build` checks and compiles backend/frontend TypeScript and copies local assets/migrations into `dist`. The HTTP test needs permission to bind a loopback port in restrictive sandboxes. The tests use temporary independent databases and deterministic inputs; they do not contact job sites or model services.

Verification is on macOS arm64 with Node 26.12.0, including an isolated self-contained offline archive and supervised SEEK/LinkedIn workflows. Fresh-OS/Gatekeeper testing and Windows, Linux, Intel Mac and Chromebook support remain unverified. See the [validation record](docs/validation-2026-10-18.md) for exact scope. See [architecture and interface](docs/architecture.md) and [references/licenses](docs/references-and-licenses.md).

## Daily review and follow-up

The table includes work arrangement/employment, compensation provenance and units, fit/confidence/concerns, saved/applied dates, source freshness and independent review/application states. Use Filters & columns to choose comparison fields and save views. Select a role for modal evidence, source reports, compensation, corrections, duplicate review and history.

[Feedback](docs/feedback.md) creates pending, reversible preference proposals only after explicit review. [Reassessment](docs/reassessment.md) uses saved evidence under an approved profile; [sparse-result diagnosis](docs/sparse-results.md) distinguishes failed access, query coverage and confirmed conflicts before proposing any broadening. [Focused company research](docs/company.md) and [unfamiliar sources](docs/custom-sources.md) retain attribution, human participation and limitations. Backups are private full-data copies; they include original resumes but exclude host credentials/session directories.
