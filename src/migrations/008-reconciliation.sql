CREATE TABLE reconciliation_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 operation_id TEXT NOT NULL UNIQUE,
 left_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 right_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 decision TEXT NOT NULL CHECK(decision IN ('link','keep_separate','none')),
 reason TEXT NOT NULL,
 reversed_event_id TEXT REFERENCES reconciliation_events(id) ON DELETE SET NULL,
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE vacancy_members (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 canonical_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX vacancy_members_canonical ON vacancy_members(canonical_job_id);
