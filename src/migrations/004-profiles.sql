CREATE TABLE profile_revisions (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  experience_json TEXT NOT NULL,
  aspirations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE TABLE search_tracks (
  profile_version INTEGER NOT NULL REFERENCES profile_revisions(version) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  titles_json TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  PRIMARY KEY(profile_version, id)
);
CREATE TABLE profile_preferences (
  profile_version INTEGER NOT NULL REFERENCES profile_revisions(version) ON DELETE CASCADE,
  track_id TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('hard', 'soft', 'undecided')),
  value_json TEXT NOT NULL,
  PRIMARY KEY(profile_version, track_id, key)
);
CREATE TABLE active_profile (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  profile_version INTEGER NOT NULL REFERENCES profile_revisions(version)
);
