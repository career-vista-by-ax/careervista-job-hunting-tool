CREATE TABLE custom_sources (
 id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE,
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE custom_source_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 source_id TEXT NOT NULL REFERENCES custom_sources(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('observation','review')),
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
