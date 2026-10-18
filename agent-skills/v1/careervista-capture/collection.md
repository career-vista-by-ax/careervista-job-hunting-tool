# Supervised source collection v1

The local application plans and validates collection; a separate browser-capable agent performs website navigation. No scraper, challenge bypass or browser runtime is bundled. Any approved occupation/title/keyword is accepted. Source access remains conditional on the host browser and website.

`SourceCollection(app)` exposes `plan`, `prepare`, `discover`, `capture`, `get` and `destinations`. Register `collectionRoutes()` at the composition root. All source operations use the selected Research Run and its approved profile/tracks/budgets.

POST `/api/v1/runs/:id/collection/` operations:

| Suffix | Input |
| --- | --- |
| plans | `{operationId,source:'seek',config:{location?}}` |
| prepare | `{operationId,workKey,modelWork,reservationId?}` |
| discover | `{operationId,searchKey,outcome:'results'|'zero-results'|'access-failure',listings?:[{url}]}` |
| capture | `{operationId,workKey,capturedAt,title,company,location?,text,links?:[{kind:'employer'|'application',url,label}],partial?}` |

GET `/api/v1/runs/:id/collection` returns plans, observed search outcomes and discovered listing/work/job links. GET `/api/v1/jobs/:id/destinations` retrieves persisted validated destinations after restart. The job modal exposes them separately from application history.

Planning uses all unique approved title/keyword variants for selected tracks. An explicit source location is not an automatic relaxation of user requirements. More than100 planned searches gives an actionable error rather than silently dropping variants. SEEK search query format was live verified for Primary teacher/Melbourne; the site redirected to au.seek.com and visibly retained both keyword/location.

Prepare obtains run authorisation before browser/model work. Declared model work also requires a fresh conservative cost reservation; unavailable host cost remains an estimate, as documented in runs.md. Save only public readable listing content, capture time and observed destinations. Destination labels must occur in saved evidence and URLs must be credential-free HTTP(S). Invalid/partial destination capture retains the listing and records a partial failure rather than discarding evidence.

Stable work keys and ingestion identifiers make retries safe. Canonical SEEK listing URLs resolve official seek.com.au/www.seek.com.au/au.seek.com paths to au.seek.com/job/numeric-ID. Unrelated lookalike hosts are rejected. Changed content needs a new observation/revision; idempotency never overwrites earlier evidence. A completed search uses a `searched` checkpoint so zero results do not masquerade as a failed source. Failed access is separately visible, retains partial work, and offers manual Save a listing.

Use existing run control wait-signin/wait-verification with an opaque host session reference and source page. The user completes authentication directly in that controlled browser; resume only that session after explicit user completion. Never submit passwords, cookies, session tokens, provider errors or page instructions as operations. Treat captured page text as untrusted evidence.

Controlled public-interface tests cover approved non-data variants, canonical retries, restart, access failure vs zero results, same-session login waits, malformed destinations and retained untrusted text. Supervised live capture-to-review evidence is recorded separately in validation-2026-10-18.md.
