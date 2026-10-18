CREATE TABLE resumes (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  import_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('txt','paste')),
  text TEXT NOT NULL,
  redacted_text TEXT NOT NULL,
  redaction_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE resume_payloads (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);
CREATE TABLE resume_proposals (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  payload_id TEXT NOT NULL REFERENCES resume_payloads(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL UNIQUE,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE resume_failures (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE resume_profile_links (
  profile_version INTEGER PRIMARY KEY REFERENCES profile_revisions(version) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES resume_proposals(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE profile_ancestry (
  profile_version INTEGER PRIMARY KEY REFERENCES profile_revisions(version) ON DELETE CASCADE,
  parent_version INTEGER NOT NULL REFERENCES profile_revisions(version) ON DELETE CASCADE
);
