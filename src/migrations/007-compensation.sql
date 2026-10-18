CREATE TABLE compensation_records (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX compensation_records_job ON compensation_records(job_id, sequence);
