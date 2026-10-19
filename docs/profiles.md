# Profile revisions and search tracks

The agent gathers goals, confirmed competitive strengths and preferences in the conversation, expands related titles and keywords, then uses this API to save a draft for any profession. `demonstratedExperience` stores factual strengths; `aspirations` stores desired future direction. Each track needs at least one title or keyword. The webpage presents the results rather than profile editing forms. See [agent workflow](agent-workflow.md).

Confirm hard requirements, soft preferences and undecided dimensions independently. Unknown compensation, location or working preferences stay undecided. Keep original compensation units and distinguish decision authority, ownership, impact and approval layers; company size is not proof of autonomy. Track preferences override shared settings, including explicit undecided values. Read the effective settings and present the draft to the user in the agent conversation before explicit approval.

Every edit creates an immutable revision; only approval activates it. An approved older revision can be activated again explicitly. Drafts never replace active settings. Expanded role families can cover individual-contributor and management directions separately when both are approved.

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

Supported standard keys: `location`, `workArrangement`, `compensation`, `benefits`, `employment`, `decisionAuthority`, `endToEndOwnership`, `impact`, `approvalLayers`. Custom keys are supported. Each preference uses `kind: hard | soft | undecided`. Undecided requires null; hard and soft need an explicit nonempty value. Values may be finite JSON for machine-readable structured criteria; agents preserve unchanged structured values when creating revisions. A consumer must handle unsupported structured criteria as unknown rather than invent a comparison. Duplicate keys within a scope and duplicate track IDs are rejected before saving.

Track IDs use letters, numbers, hyphens and underscores. Empty experience and aspiration lists are allowed; they are not fabricated to satisfy onboarding. Limits are 50 tracks, 100 preferences per scope, 1000 entries per text list, 8000 characters per text entry, and 64000 characters/20 levels for a structured preference. Additional app-wide HTTP limits apply. Profiles are stored in explicit relational tables in migration `004-profiles.sql`.

Private backups include profile revisions, tracks, preferences and active-profile selection.

Resume onboarding can create a linked unapproved draft; see [resume import](resume.md). Profile edits may supply optional `basedOnVersion` to retain ancestry. Agents supply the previous revision when revising a profile. Creating a draft uses a SAVEPOINT so a module may atomically attach provenance inside an outer transaction; public draft/approval behavior remains unchanged.
