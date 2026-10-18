# CareerVista

A private, single-user job research workspace. Save any kind of job listing and read its original evidence later, including offline. Each person uses a separate installation and database. No application account, model key, or agent is needed for local review.

## Mac development launch

This is the source/developer workflow. Self-contained end-user archives and installation lifecycle are tracked separately; the source workflow is not the promised installer.

1. Install [mise](https://mise.jdx.dev/getting-started.html), then run `mise trust` and `mise install` in this repository.
2. Run `mise exec -- npm ci` and `mise exec -- npm run build`.
3. Run `mise exec -- npm start` and open [CareerVista](http://127.0.0.1:4318).
4. Choose **Save a listing**, enter the source URL and basic details, and paste the readable listing text. Choose its title in the table to read the evidence. Open **Profile & search tracks** to create, review and explicitly approve your search preferences; see [profile help](docs/profiles.md).
5. Stop with Control+C. Start again to review stored records. After the build, launching and reviewing needs no network access or agent.

The server binds exclusively to `127.0.0.1`; it rejects unexpected Host headers, foreign origins and cross-site browser requests. Open the exact address printed at launch. This is a local, single-user interface, not a remotely hosted service. Other processes running as your user can access it.

Set `CAREERVISTA_ROOT` to choose an independent root; set `CAREERVISTA_PORT` if 4318 is occupied (0 selects a free port). Default Mac root: `~/Library/Application Support/CareerVista`.

| Directory | Ownership and purpose |
| --- | --- |
| `app/` | Reserved for owned application/runtime release files |
| `data/` | Persistent SQLite database and its live SQLite journals |
| `cache/` | Disposable app caches; currently unused |
| `temp/` | Disposable app temporary files; currently unused |
| `logs/` | Disposable app logs; currently unused; launch messages go to terminal |
| `sessions/` | Persistent supported agent browser sessions; currently unused |
| `credentials/` | Persistent optional provider credentials; currently unused |

Never remove `data`, `sessions`, or `credentials` as cache cleanup. Do not manually delete live SQLite WAL/journal files. The app makes no runtime downloads and writes no accumulating cache or log files in this slice.

## Development checks

`mise exec -- npm test` runs behavioral tests through the public application and HTTP interfaces. `mise exec -- npm run build` checks and compiles backend/frontend TypeScript and copies local assets/migrations into `dist`. The HTTP test needs permission to bind a loopback port in restrictive sandboxes. The tests use temporary independent databases and deterministic inputs; they do not contact job sites or model services.

Initial verification is on macOS arm64 with Node 26.12.0. Windows, Linux, Chromebook, release archive installation and live browser-agent workflows remain unverified. See [architecture and interface](docs/architecture.md) and [references/licenses](docs/references-and-licenses.md).
