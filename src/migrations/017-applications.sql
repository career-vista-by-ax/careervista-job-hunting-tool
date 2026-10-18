CREATE TABLE application_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  note TEXT NOT NULL,
  documents_json TEXT NOT NULL,
  follow_up_on TEXT,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX application_events_job ON application_events(job_id, sequence);
