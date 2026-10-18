# CareerVista

CareerVista is a private, local job-research assistant and application tracker for **any profession, industry or seniority**. Your browser-capable agent searches approved sources, saves the original evidence and explains what is known, uncertain or missing. You compare jobs in a table, open details in a modal and decide what to pursue.

- Approve your experience, aspirations, search tracks and hard/soft preferences.
- Research SEEK, LinkedIn, employer listings and explicitly approved additional sources within a listing limit and spending budget.
- Compare requirements, work arrangements, compensation provenance, fit/confidence and source freshness.
- Save/dismiss jobs, review reversible preference proposals, reassess saved evidence and track application progress separately.
- Keep records in your own SQLite database, review them offline, and export or restore private backups.

CareerVista is model and agent independent: any compatible host with browser tools and access to the local HTTP interface can use it. Codex desktop was used for development validation. Each person uses a separate installation and database. Local review needs no application account or AI provider key; model/provider settings belong to your agent host. Applications and messages remain your explicit actions.

## Install on an Apple Silicon Mac

1. Open the private [Releases page](https://github.com/allenhori/careervista-job-hunting-tool/releases) and download the latest `CareerVista-…-macos-arm64.tar.gz` archive. GitHub access to this private repository is required to download it.
2. Extract the archive and keep the resulting folder somewhere convenient.
3. Open that folder and double-click **CareerVista.command**. It installs the bundled runtime and app, then opens the local workspace in your browser.
4. Use **CareerVista.command** again whenever you want to reopen the app. An existing running instance is reused.

No Node, npm, mise, compiler, Git or Docker installation is needed. The default data location is `~/Library/Application Support/CareerVista`. The archive starts with an empty database; development sample jobs and profiles are not included.

This is a **Mac arm64 preview**, tested in isolated installations on the maintainer's Mac. Clean-machine Gatekeeper/quarantine and notarization remain unverified; the archive is not notarized. Windows, Linux, Intel Mac and Chromebook builds remain unverified. See [release instructions and support limits](docs/release.md).

## First use

1. Open **Profile & search tracks**. Enter your experience separately from what you want next, choose job titles/keywords and working preferences, then explicitly approve the profile and tracks. Optional **Import resume** accepts pasted text or a UTF-8 `.txt` file; review the redacted payload before allowing agent analysis. See [resume onboarding](docs/resume.md).
2. To try manual capture, choose **Save a listing**, paste its URL and readable text, then select the saved role in the table. Original evidence remains available offline.
3. For agent research, complete the setup below, then open **Research runs**. Select approved tracks and sources, choose a small listing limit and spending cap, and create a run. Copy its **Run reference**.
4. Give your agent the run reference and the exact local URL from your browser's address bar. The installed app chooses a free port; use that URL rather than assuming port 4318.
5. When the agent saves results, choose **Refresh** in the jobs table. Use **Filters & columns** and saved views to compare jobs; select a role to inspect evidence, unknowns, concerns and source links in the modal.

Creating a run stores its boundaries and checkpoints. **Your agent performs the browsing and analysis**; the app does not launch an agent or call a model automatically. If collection fails, manual capture remains available.

## Use it with an agent

Run your agent on the same computer with browser-control tools and permission to reach CareerVista's local HTTP interface. Configure its model/provider in that host; CareerVista does not require a particular provider or SDK.

For Codex, open Terminal in the extracted release folder and run:

```sh
./CareerVista.command register-skills --host codex
```

For a compatible host using `~/.agents/skills`, use `--host agents` instead. Registration uses the bundled runtime, records installation ownership and preserves unrelated skills. Reload skills in your host and start a new conversation. The skill's name is **careervista-capture**.

If your host does not support skill registration, give the agent the extracted folder's `agent-skills/v1/careervista-capture/SKILL.md` file directly. It routes to the source and API instructions beside it.

After creating a research run, replace the two placeholders in this starter prompt:

```text
Use CareerVista at <LOCAL_URL>. Read the careervista-capture skill and
its collection/source instructions, then carry out Research Run <RUN_ID>.
Use its approved profile/tracks, selected sources, listing limit and budget.
Save original readable evidence before extraction and fit analysis. Keep
unknowns and source attribution visible, and preserve saved checkpoints.
Pause for me to complete website sign-in or verification in the same browser.
Show me the saved jobs and any limitations when finished.
Do not submit applications or send messages.
```

Website sign-in happens directly on the website in the agent's controlled browser. Resume that same session after completing it. Budget reports distinguish known costs from conservative estimates; your host owns actual billing and may incur unrelated costs outside the run.

## Daily review and follow-up

The table includes employment/work arrangement, compensation provenance and units, fit/confidence/concerns, saved/applied dates, source freshness and independent review/application states. Full values, original observations and earlier reasoning stay available in the modal.

- **Your decision:** save/pursue or dismiss a job, with an optional reason. This does not change the agent's assessment or your general preferences.
- **Preference proposals:** explicitly apply, reject or reverse a suggested change; adding/restoring hard exclusions requires separate confirmation.
- **Reassess saved jobs:** evaluate cached evidence under an approved profile revision, including previously excluded jobs.
- **Diagnose results:** distinguish failed access, incomplete query coverage and evidenced preference conflicts before proposing changes.
- **Application history:** record progress, existing document references and follow-up dates yourself. Opening an apply link does not record an application.
- **Backup and restore:** keep private full-data backups. They include original resumes and evidence, but exclude host credentials/browser-session directories. External document files must be copied separately.

More detail: [agent/API interface](docs/agent-interface.md), [research runs](docs/runs.md), [feedback](docs/feedback.md), [reassessment](docs/reassessment.md), [company research](docs/company.md) and [additional sources](docs/custom-sources.md).

## Stop, storage and uninstall

From Terminal in the extracted release folder:

```sh
./CareerVista.command stop
./CareerVista.command storage
./CareerVista.command clear-cache
./CareerVista.command uninstall
```

Uninstall keeps your evidence, profiles, credentials and sessions by default. Reinstall from the archive to reuse retained data. Explicit permanent-removal commands and separate installation roots are documented in [release.md](docs/release.md). Store exported backups privately; deleting an installation does not delete separate backup copies.

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

## Development checks

`mise exec -- node --test tests/*.test.ts` runs behavioral tests through the public application and HTTP interfaces. `mise exec -- npm run build` checks and compiles backend/frontend TypeScript and copies local assets/migrations into `dist`. The HTTP test needs permission to bind a loopback port in restrictive sandboxes. The tests use temporary independent databases and deterministic inputs; they do not contact job sites or model services.

Verification is on macOS arm64 with Node 26.12.0, including an isolated self-contained offline archive and supervised SEEK/LinkedIn workflows. Fresh-OS/Gatekeeper testing and Windows, Linux, Intel Mac and Chromebook support remain unverified. See the [validation record](docs/validation-2026-10-18.md) for exact scope. See [architecture and interface](docs/architecture.md) and [references/licenses](docs/references-and-licenses.md).
