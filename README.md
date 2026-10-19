# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

CareerVista is a private, local job-research assistant and application tracker for the **Australian job market, across any profession, industry or seniority**. Your browser-capable agent handles the conversation: it clarifies goals, expands related role titles, reads a supplied resume, searches approved sources and saves evidence-backed reasoning. You compare jobs in a table, open details in a modal and decide what to pursue.

- Tell your agent what you want next; confirm competitive strengths, related role families and hard/soft preferences in that conversation.
- Research SEEK, LinkedIn, employer listings and explicitly approved additional sources within a listing limit and spending budget.
- Discover compact candidates before detailed assessment, using batch host search tools or the public Greenhouse/Lever collector; see [efficient collection](docs/collection.md).
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

This is a **Mac arm64 preview**, tested in isolated installations on the maintainer's Mac. Clean-machine Gatekeeper/quarantine and notarization remain unverified; the archive is not notarized. Linux, Intel Mac and Chromebook builds remain unverified. Windows x64 packaging and native CI are described below. See [release instructions and support limits](docs/release.md).

## Install on Windows x64

1. Download the `CareerVista-…-windows-x64.zip` preview from [Releases](https://github.com/allenhori/careervista-job-hunting-tool/releases) when available. Native CI builds are also attached to successful [Windows acceptance runs](https://github.com/allenhori/careervista-job-hunting-tool/actions/workflows/windows.yml).
2. Use **Extract All** and keep the extracted folder. Open **CareerVista.cmd** from that folder, rather than from inside the ZIP.
3. The launcher installs its bundled Node runtime and application under `%LOCALAPPDATA%\CareerVista` and opens the local webpage. No Node, npm, Git, WSL, Docker or administrator access is required.
4. Reopen **CareerVista.cmd** to return to the same data. Each Windows/Mac installation has its own database; use private backup/restore to transfer records, never share a live SQLite file between computers.

The Windows build is an unsigned x64 preview. The CI workflow tests the extracted ZIP, paths with spaces, bundled-runtime launch, persistence, forward upgrade and keep-data/removal behavior on a Windows runner. Clean-machine Explorer/SmartScreen behavior and a Windows agent host require separate verification; Windows ARM64 is not a tested target. See [release instructions](docs/release.md).

## Upgrade an existing installation

Download the newer release and extract it into a new folder. From Terminal or PowerShell **in that new folder**, run:

```sh
# Mac
./CareerVista.command upgrade
```

```powershell
# Windows
.\CareerVista.cmd upgrade
```

The command installs the version in that folder, safely stops the previous app, preserves your jobs, profiles, resumes and application history, validates any database migration, and reopens CareerVista. It needs no uninstall. Repeating it for the already installed version reuses the running app. Add `--no-browser` to print the new local URL instead of opening it. If you originally chose a custom data root, pass the same `--root /path/to/your/root`.

`upgrade` uses the release you downloaded; it does not automatically download updates. Double-clicking the new launcher also upgrades when needed. Keep the newer extracted folder as your launcher afterward. Migration failure restores the installer's private snapshot and keeps the previous release selected.

## First use

1. Launch CareerVista and complete the agent setup below. Give the agent the exact local URL from your browser's address bar; the launcher chooses a free port.
2. Describe your goal in the agent conversation. For example: “Find principal analytics engineer roles around Melbourne.” The agent considers related titles such as staff/lead analytics engineer and asks whether data engineering or data-management roles are relevant. This works for any profession in Australia.
3. Optionally give the agent a PDF, Word resume or text. Its own document tools interpret the file; it saves the parsed base CV locally for later sessions, confirms useful competitive strengths with you and links the authorised facts to your profile. Tailored CVs, cover-letter drafts and change recommendations are saved separately with base/parent/job lineage; they never overwrite the base. The webpage has no resume-upload/parser form. Unsupported/scanned documents need the host's readable-text/OCR fallback, or you can search without a resume.
4. Agree the role families, preferences, sources, batch size and spending boundary in the conversation. The agent saves the approved profile/run, searches across the agreed variants, analyses the evidence and records shortlist reasons, concerns and unknowns. It asks one question at a time with a recommendation, choices and custom input, covering work arrangement, base/super, equity, leave, benefits and review priorities as needed. It then asks which sites to use (SEEK, LinkedIn, Glassdoor, Indeed or your own choices), and may refine the search after discovery.
5. When the batch is ready, the agent sends you to the webpage to browse. The table updates periodically while visible; **Refresh** updates immediately. Open a role for **Why this job is here**, the original evidence, compensation and history. **Filters & columns** contains optional display settings and saved views.

**The agent performs document reading, browsing and analysis.** CareerVista validates and stores its output; it never launches a model automatically. Return to the agent to refine the search, investigate a concern, save/dismiss a job or record application progress. **Agent setup** on the webpage contains a starter prompt and local backup/export/removal tools.

## Use it with an agent

Run your agent on the same computer with browser-control tools and permission to reach CareerVista's local HTTP interface. Configure its model/provider in that host; CareerVista does not require a particular provider or SDK.

For Codex, open Terminal in the extracted release folder and run:

```sh
./CareerVista.command register-skills --host codex
```

On Windows, run the equivalent in PowerShell from the extracted folder:

```powershell
.\CareerVista.cmd register-skills --host codex
```

For a compatible host using `~/.agents/skills`, use `--host agents` instead. Registration uses the bundled runtime, records installation ownership and preserves unrelated skills. Reload skills in your host and start a new conversation. The skill's name is **careervista-capture**.

If your host does not support skill registration, give the agent the extracted folder's `agent-skills/v1/careervista-capture/SKILL.md` file directly. It routes to the source and API instructions beside it.

Replace the local URL in this starter prompt; no pre-created run is required:

```text
Use CareerVista at <LOCAL_URL> with the careervista-capture skill.
Help me find principal analytics engineer roles. Expand related titles,
including staff/lead roles, and clarify whether data engineering or data
management is in scope. Ask about important goals and constraints; if I
share a resume, confirm my competitive strengths from it. Agree sources,
a batch limit and a budget with me, then search and analyse in this agent.
Save original evidence, shortlist reasons, concerns and unknowns.
When the batch is ready, send me to the webpage to browse the results.
Do not submit applications or send messages.
```

Change the example role to any occupation in Australia. The skill reads the running app's versioned workflow/API guides at `/api/v1/agent-guide`; it can create profiles, expanded tracks and bounded runs directly. No webpage onboarding forms are needed.

Website sign-in happens directly on the website in the agent's controlled browser. Resume that same session after completing it. Budget reports distinguish known costs from conservative estimates; your host owns actual billing and may incur unrelated costs outside the run.

## Standalone CV skill: `/ax-cv`

**老徐的简历修改** is a self-contained, model-independent [CV skill](https://github.com/allenhori/careervista-job-hunting-tool/tree/main/agent-skills/v1/ax-cv). Its one-file folder is `agent-skills/v1/ax-cv/SKILL.md`, also included in the extracted release. Copy the `ax-cv` folder into your agent host's documented skill directory, or let any agent read the Markdown directly. `/ax-cv` is the shorthand; actual slash/skill invocation depends on the host. It needs no CareerVista server or LinkedIn plugin. Document rendering uses the host's available tools.

CareerVista's job-hunting skill loads the same rules through `/api/v1/agent-guide/ax-cv` when enhancing a CV. The core skill preserves a reusable factual base, tailors highlights most, uses human achievement-led language and requires rendered CVs to stay within four pages with accurate page numbering. Connected use saves base CVs and separate tailored variants through the app API; standalone use saves agreed local versions.

## Daily review and follow-up

The table includes employment/work arrangement, compensation provenance and units, fit/confidence/concerns, saved/applied dates, source freshness and independent review/application states. Full values, original observations and earlier reasoning stay available in the modal.

- Tell the agent which jobs to save/pursue or dismiss and why. Your decision stays separate from its assessment and application status.
- Ask the agent to investigate gaps, propose preference changes or reassess cached evidence. It confirms material changes, including hard exclusions, before applying them.
- Report application progress to the agent; the modal displays its saved timeline. Opening a listing never records an application.
- Use **Agent setup → Local data** for private backups, restore, export and explicit removal. Backups exclude host credentials/browser sessions; copy externally referenced documents separately.

More detail: [agent/API interface](docs/agent-interface.md), [research runs](docs/runs.md), [feedback](docs/feedback.md), [reassessment](docs/reassessment.md), [company research](docs/company.md) and [additional sources](docs/custom-sources.md).

## Stop, storage and uninstall

From Terminal in the extracted release folder (Windows: use `.\CareerVista.cmd` for each command):

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
4. Give a browser-capable agent the running URL and `agent-skills/v1/careervista-capture/SKILL.md`. Start the conversation-first workflow, then browse saved results in the table. See [agent workflow](docs/agent-workflow.md).
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

Verification is on macOS arm64 with Node 26.12.0, including an isolated self-contained offline archive and supervised SEEK/LinkedIn workflows. Fresh-OS/Gatekeeper testing and Linux, Intel Mac and Chromebook support remain unverified. Windows x64 has a separate native acceptance workflow; fresh consumer installations and the Windows agent host remain unverified. See the [validation record](docs/validation-2026-10-18.md) for exact scope. See [architecture and interface](docs/architecture.md) and [references/licenses](docs/references-and-licenses.md).
