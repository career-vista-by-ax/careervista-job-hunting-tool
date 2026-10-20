# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁体中文](README.zh-TW.md)

Find your next role in Australia with your AI agent. CareerVista keeps job
evidence, recommendations and application records in a local workspace.

## Start

Tell your agent:

```text
Install and start CareerVista from https://github.com/career-vista-by-ax/careervista-job-hunting-tool
```

Once installed, start future sessions with:

```text
$careervista-job-search
```

Or say **“Use careervista-job-search.”** Your agent handles the privacy notice,
setup checks, Docker or local installation, and job-search questions one step at
a time. You don't need special wording, a running app or a CV to begin. It reuses
an existing setup when available and gives you a link to the local jobs table.

Optional CLI installation (requires Node/npm):

```sh
npx skills add career-vista-by-ax/careervista-job-hunting-tool --skill careervista-job-search --skill ax-cv --skill ax-30-secs
```

## What it does

- Research Australian jobs and explain recommendations using original evidence.
- Improve your CV with `ax-cv` and review it with `ax-30-secs`.
- Track applications, contacts and documents locally in English, 简体中文 or 繁体中文.
- Reduce agent work with preview screening, batch operations and saved evidence.

Your chosen agent provides the model, browsing and document tools; its usage
charges and data policies apply. CareerVista stores saved records locally.
You apply yourself through the original advert. CareerVista does not submit
applications or send messages for you.

## Docker and references

The starter skill pulls the public `careervista/careervista:0.2.0-preview.3` image,
pinned by digest in its distribution metadata, and guides installation. Docker
users need Docker running; no Docker Hub account, source checkout or local build
is required. If you installed the skills before this release, update them from
this repository first.
Maintainers publish with the manual [Docker Hub workflow](docs/release.md#publish-a-prebuilt-docker-hub-image).
The pull-only `compose.published.yaml` also supports the published image. Source-build instructions remain in the release guide.

[Runtime and releases](docs/release.md) · [Agent tasks](docs/agent-tasks.md) ·
[Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md)

Licensed under [GNU GPL v3 only](LICENSE). Contributions require the [CLA](CLA.md).
