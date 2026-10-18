# Profile revisions and search tracks

Open **Profile & search tracks** in the local workspace. Create a profile, record demonstrated experience separately from aspirations, and add named tracks for any profession. Enter title and keyword variants one per line. Each track must contain at least one title or keyword. The tool does not preselect an industry or infer aspirations from employment history.

Choose **Hard requirement**, **Soft preference** or **Undecided** independently for each shared dimension. Unknown compensation, location or working preferences remain undecided rather than becoming exclusions. Express compensation with its original units: currency, period, base/package and superannuation. Decision authority, end-to-end ownership, impact and approval layers are separate dimensions; company size is not evidence of autonomy.

For a track, **Use shared preference** inherits the shared value; any explicit track setting wins, including **Undecided**. For example, a shared hard Melbourne location can be replaced by a soft Victoria location for a leadership track. Saving a draft shows each track's effective settings and whether each comes from the shared profile or a track override. Draft variants and preferences do not guide active searches until you choose **Approve profile, tracks & variants**.

Every edit creates an immutable new revision. Revision history retains old experience, aspirations, tracks and preference values. Approval marks the revision and selects it as the active profile without deleting previous approvals. An older approved revision can be selected again explicitly. A saved draft never replaces the active profile. There is no model or provider prerequisite.

## Public interface

`ProfilesService(app)` in `src/profiles.ts` provides `createDraft(input)`, `getProfile(version)`, `listProfiles()`, `getActiveProfile()`, `effectivePreferences(version, trackId)` and `approve(version)`. `getActiveProfile()` returns null until explicit approval. The `Profile` returned by these operations includes revision metadata, approval status, and the full snapshot of experience, aspirations, shared preferences and tracks. The returned objects are independent copies; changing one does not mutate storage.

Register `profileRoutes(new ProfilesService(app))` in the HTTP composition root. Endpoints:

| Method/path | Operation |
| --- | --- |
| `GET /api/v1/profiles` | Full revision history, newest first |
| `POST /api/v1/profiles` | Create a draft snapshot; 201 |
| `GET /api/v1/profiles/active` | Approved active snapshot or null |
| `GET /api/v1/profiles/:version` | Retrieve a revision |
| `POST /api/v1/profiles/:version/approve` | Explicitly approve and activate; repeated approval retains original approval timestamp |
| `GET /api/v1/profiles/:version/tracks/:trackId/effective` | Shared preferences overlaid with explicit track preferences, each with `origin: shared` or `track` |

The draft payload is:

```json
{
  "name": "My teaching search",
  "demonstratedExperience": ["Five years of primary school teaching"],
  "aspirations": ["Lead a year-level team"],
  "preferences": [
    {"key": "location", "kind": "hard", "value": "Melbourne"},
    {"key": "compensation", "kind": "undecided", "value": null},
    {"key": "decisionAuthority", "kind": "soft", "value": "Choose teaching methods"}
  ],
  "tracks": [{
    "id": "year-level-lead", "name": "Teaching leadership",
    "titles": ["Year-level coordinator"], "keywords": ["school leadership"],
    "preferences": [{"key": "location", "kind": "soft", "value": "Victoria"}]
  }]
}
```

Supported standard keys: `location`, `workArrangement`, `compensation`, `benefits`, `employment`, `decisionAuthority`, `endToEndOwnership`, `impact`, `approvalLayers`. Custom keys are supported. Each preference uses `kind: hard | soft | undecided`. Undecided requires null; hard and soft need an explicit nonempty value. Values may be finite JSON for machine-readable structured criteria; the UI preserves unchanged structured values and accepts readable text for edits. A consumer must handle unsupported structured criteria as unknown rather than invent a comparison. Duplicate keys within a scope and duplicate track IDs are rejected before saving.

Track IDs use letters, numbers, hyphens and underscores. Empty experience and aspiration lists are allowed; they are not fabricated to satisfy onboarding. Limits are 50 tracks, 100 preferences per scope, 1000 entries per text list, 8000 characters per text entry, and 64000 characters/20 levels for a structured preference. Additional app-wide HTTP limits apply. Profiles are stored in explicit relational tables in migration `004-profiles.sql`.

No backup/export/deletion contract existed when this slice was written; the lifecycle slice must include profile revisions, tracks, preferences and active-profile selection. Revision-history UI and API are local and work offline. Resume parsing and learned preference proposals remain separate tickets.

Resume onboarding can create a linked unapproved draft; see [resume import](resume.md). Profile edits may supply optional `basedOnVersion` to retain ancestry. The standard edit UI supplies the previous revision automatically. Creating a draft uses a SAVEPOINT so a module may atomically attach provenance inside an outer transaction; public draft/approval behavior remains unchanged.
