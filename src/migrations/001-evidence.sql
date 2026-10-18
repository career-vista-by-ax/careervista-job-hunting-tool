CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ingestion_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  text TEXT NOT NULL,
  context_json TEXT NOT NULL,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
