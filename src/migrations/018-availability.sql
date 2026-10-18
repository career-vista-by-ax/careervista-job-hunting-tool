CREATE TABLE availability_checks (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX availability_checks_job ON availability_checks(job_id,sequence);
