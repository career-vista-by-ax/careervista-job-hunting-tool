# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁体中文](README.zh-TW.md)

CareerVista helps you find your next role in Australia. Your agent clarifies your
goals, researches jobs and explains its recommendations; a local workspace keeps
the evidence, shortlist and application records for you to browse.

**Start by installing the skills. The starter skill guides the rest of setup.**
You do not need to launch a website or find an executable path first.

## 1. Install the skills

Paste this into your agent:

```text
Install the CareerVista skills from
https://github.com/career-vista-by-ax/careervista-job-hunting-tool
using this agent's supported skill installer and the repository's default branch.
Install these directories: agent-skills/v1/careervista-job-search,
agent-skills/v1/ax-cv and agent-skills/v1/ax-30-secs.
Install skills only, then tell me how to start careervista-job-search.
```

The repository is currently private. Use your existing GitHub authentication;
if access fails, sign in through your normal tools. Do not paste access tokens
into the conversation.

<details>
<summary>Optional: install using the skills CLI</summary>

If Node/npm is already available, you can use the
[skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add career-vista-by-ax/careervista-job-hunting-tool --skill careervista-job-search --skill ax-cv --skill ax-30-secs
```

Choose your agent host when prompted. This installs instructions, not the app.

</details>

## 2. Start the guided flow

Once the skills are available, tell your agent:

```text
Use the careervista-job-search skill to help me find my next role in Australia.
```

You can add your own goals in the same message. Invocation syntax varies by
agent; in Codex you can also use `$careervista-job-search`.

The first decision is a privacy acknowledgement: review how local CareerVista
storage differs from data processing by your chosen agent/model/tools, then
choose **I understand and agree to continue** or **Stop — do not proceed**.
Setup, document reads and research wait for explicit agreement.

The skill then guides your preferred language and Docker versus a local copy, asks
for the required permissions, then finds or starts the workspace and verifies
its actual address. It checks available releases/images rather than assuming
a fixed URL or executable path. No registry image has been published yet; if
needed, it can offer a source build with your permission.

It uses clickable choices through your agent’s native question tool when
available, with custom answers; text choices are the fallback for hosts without
that UI. It asks one question at a time, confirms your strengths from an optional
resume, expands related titles and agrees locations, work arrangements,
AUD base/super, priorities, sites, search scope and budget before researching.
Searches batch approved keyword variants through search tools/public APIs first,
then read selected original pages headlessly. Docker includes Playwright and
Chromium for JavaScript pages, with no local Playwright install. Login,
verification or blocking triggers a fallback to your default host browser.
Blocked or suspicious responses remain unverified, never job/review evidence.
Optional local task helpers wrap the same HTTP API for compact planning,
preview screening and evidence/assessment saves; see [agent tasks](docs/agent-tasks.md).
As soon as the local connection is verified, the agent gives you a clickable
**Open CareerVista** link before intake or research. Click it to open the local
jobs page and see saved results appear; a new workspace may initially be empty.
The agent shares the link again when the batch is ready.

## Your skill set

| Skill | Use it for |
| --- | --- |
| `careervista-job-search` | Guided setup, job research and evidence-backed recommendations |
| `ax-cv` | Truthful Australian-market CV improvement and tailoring |
| `ax-30-secs` | A simulated 30-second CV or cover-letter skim and concrete improvements |

Skills use your agent's own browser, HTTP and document tools. Supported tool
capabilities and model costs belong to that host; no particular provider is
required. Skills and the app runtime are installed independently.

The workspace supports archives, recoverable deletion, application stages,
contacts, saved document copies and in-app follow-up reminders. Choose English,
简体中文 or 繁体中文; original English listing evidence remains available.

**You apply yourself through the original advert's Apply button.** CareerVista
does not auto-apply, complete application forms or send messages for you.

## Reference

- [Manual runtime operations, updates and support limits](docs/release.md)
- [Search and application records](docs/history.md) · [Languages](docs/language.md)
- [Agent workflow](docs/agent-workflow.md) · [Architecture](docs/architecture.md)
- [Contributing and development](CONTRIBUTING.md) · [Validation](docs/validation-2026-10-20.md)

The repository is private for now. Licensing and public distribution terms
remain undecided.
