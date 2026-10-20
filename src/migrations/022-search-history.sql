CREATE TABLE search_archives (
 id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE job_storage (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 archive_id TEXT REFERENCES search_archives(id),
 deleted_at TEXT
);
CREATE TABLE deleted_job_sources (
 source_key TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE
);
ALTER TABLE application_events ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';
CREATE TABLE application_files (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 kind TEXT NOT NULL,
 content_base64 TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 size INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
