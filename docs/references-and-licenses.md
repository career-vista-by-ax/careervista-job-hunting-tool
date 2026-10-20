# References and dependency-license inventory

Recorded 2026-10-18. Original application implementation; no JobSync or other application's code was copied. CareerVista original code is GPL-3.0-only; see the root LICENSE. Third-party components retain their own licenses and notices.

| Material | Role | License / provenance |
| --- | --- | --- |
| [JobSync](https://github.com/Gsync/jobsync) and its [Jobs workflow](https://github.com/Gsync/jobsync/wiki/Jobs) | Product workflow reference in parent spec | Documentation reference only; no imported implementation |
| [Node.js 26.12.0](https://nodejs.org/en/blog/release/v26.12.0) | Pinned runtime; native HTTP, SQLite and tests | Node distribution includes MIT license and third-party notices; release packaging must include its complete LICENSE/notice files |
| [mise](https://mise.jdx.dev/getting-started.html) | Development runtime management | MIT; not required at user launch |
| [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2 | Development compiler | Apache-2.0; exact platform compiler packages also Apache-2.0 |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) 26.6.5 | Development types | MIT |
| [undici-types](https://github.com/nodejs/undici) 8.9.0 | Transitive development types | MIT |

The exact dependency graph, platform variants, integrity hashes and npm license declarations are in `package-lock.json`. There are zero production npm dependencies in the first slice. `typescript@7.0.2` uses the locked platform-specific compiler as an optional build dependency. Do not ship build-tool `node_modules` in the production archive.

Registry stable versions were checked with `npm view typescript version` and `npm view @types/node version` during implementation. Node 26.12.0 was verified by the integration coordinator against the release page and executed locally. Native SQLite is part of the selected Node distribution; its bundled license notices must accompany any redistributed runtime. Mac runtime launch and tests do not establish tested support for other OS/architectures or the agent host.

The owner’s table refinement was compared with the [published jobs-table screenshot](https://github.com/Gsync/jobsync/blob/main/screenshots/jobsync-jobs.png) and the Jobs wiki on 2026-10-18. Reference fields include applied/added dates, title/type/workplace, company, location, status, match and source. CareerVista uses its own implementation and separate fit/confidence/provenance semantics; no screenshot asset or code is shipped.

Native Mac packaging now includes the complete Node distribution LICENSE, the TypeScript and native arm64 compiler LICENSE/NOTICE, @types/node and undici-types notices, this inventory and the exact build lock under licenses/. Build tools are not shipped as executable dependencies. The provenance record distinguishes local runtime hashes from an unverified upstream archive checksum; no browser-capable agent host is redistributed.
