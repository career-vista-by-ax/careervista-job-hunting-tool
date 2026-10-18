# Initial application boundary

## Decision

TypeScript backend and frontend, Node.js 26.12.0, native `node:http` server and `node:sqlite` transactional persistence. No runtime npm dependencies. The browser uses compiled local TypeScript and CSS, so the first local screen and stored evidence require no CDN or network. The choice proves the first ingestion/review slice without committing to a UI framework or agent host.

Development versions are pinned by `mise.toml` and `package-lock.json`. Build tools are not production dependencies. Release packaging can place `dist/` and the tested Node runtime under owned `app/` and launch `dist/main.js` without npm, mise, Git, Docker or a compiler. This compatibility is not a claim that the installer exists in this slice.

The app does not make source-site requests or run a model during ingestion. It first retains original readable text and capture context. Agents may be any compatible host and model; future structured analysis is submitted through explicit versioned operations, separately from evidence. A cloud key must never be mandatory to save/review evidence.

## Public version 1 HTTP interface

Base URL is the exact loopback origin printed on launch. JSON endpoints return JSON. Errors have `{ "error": { "code": "...", "message": "actionable explanation" } }`. POST requires `Content-Type: application/json`. Requests with an Origin header must match the exact local origin. There is no application login. The local OS user is the trust boundary.

### POST /api/v1/observations

```json
{
  "ingestionId": "my-agent:run-7:listing-1",
  "source": "employer",
  "sourceUrl": "https://example.com/careers/42",
  "capturedAt": "2026-10-18T01:00:00.000Z",
  "text": "Full readable captured listing text",
  "title": "Store manager",
  "company": "Example company",
  "location": "Melbourne",
  "context": { "method": "manual-paste" }
}
```

`location` and `context` are optional. Other fields must be non-empty strings. Text is limited to one million characters; other strings to 8000. Requests are limited to 2 MB. Source URLs must use HTTP(S) and contain no embedded credentials; capture time must be ISO 8601. Source text is stored verbatim and rendered as text, never executable HTML. No URL is fetched during save.

Returns 201 with `{job, observation, replayed:false}`. Identical retries with the same `ingestionId` return 200 and the existing IDs with `replayed:true`. JSON object key order does not change identity. Reusing the identifier with changed content returns 409 `idempotency_conflict`; submit a new identifier for a revision. This slice creates one Job per distinct ingestion identifier; later reconciliation adds cross-source vacancy matching.

### GET /api/v1/jobs

Returns a JSON array of `{id,title,company,location,createdAt,sources}`, newest saved first. Unknown location is null, not an asserted mismatch.

### GET /api/v1/jobs/:id

Returns those fields plus `observations`, each containing `{id,jobId,ingestionId,source,sourceUrl,capturedAt,text,context,createdAt}`. Unknown ID returns 404. Evidence remains available after process restart without network access.

## Module extension contract

`CareerVistaApp` in `src/app.ts` is the public in-process application boundary used by tests and the transport. Instantiate with `{root}`, call public operations, and always call `close()`. External agents use HTTP and must never open or modify the SQLite file.

Internal modules may own repositories using `app.database`, a synchronous `DatabaseSync` connection with foreign keys, WAL and busy timeout enabled. Add additive explicit SQL migrations in `src/migrations/` with unique ticket-based prefixes (for example `003-analysis.sql`, `004-profiles.sql`). Do not edit an applied migration. Migrations execute alphabetically and each runs in a transaction; design dependencies accordingly. The build automatically includes new migrations. Keep module code in separate files rather than growing the initial core class.

`startServer(app,{port,routes})` accepts `ApiRoute[]`; each route receives `{app,request,response,url,json,send}` and returns true after handling. Routes run under the same host/origin controls and error mapping. A route may throw `AppError(message,status,code)`. Register new routes with small imports at the composition root (`src/main.ts`), keeping modules independent. New endpoints should retain `/api/v1/` and input validation, idempotency and evidence lineage conventions. Tests should instantiate modules through their public application operations or register routes and exercise HTTP, not query private tables.

The browser entry point is `src/public/client.ts`; it uses text nodes for untrusted evidence and real buttons/labels/table headings for keyboard operation. Review uses a compact full-width sortable/filterable table; selecting a job opens a native modal dialog with Escape close and focus restoration. Source names are included in list summaries, so the table does not download full evidence for every row. Styles and HTML are local assets. Future daily workspace work can replace this minimal table/detail view while preserving the public interface.

Listing evidence, application history, [profile revisions and search tracks](profiles.md), and agent-submitted extraction are implemented. See [agent interface](agent-interface.md) for the extraction service, immutable analysis schema and skill registration boundary. Assessment, reconciliation, bounded runs, collection, backup/export/deletion and release lifecycle remain tracked tickets.
