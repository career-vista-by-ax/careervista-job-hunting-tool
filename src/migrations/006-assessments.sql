CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL UNIQUE,
  profile_version INTEGER NOT NULL,
  track_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK(label IN ('strong','promising','investigate','low_fit','excluded')),
  rules_version TEXT NOT NULL,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(profile_version,track_id) REFERENCES search_tracks(profile_version,id) ON DELETE CASCADE
);
CREATE TABLE assessment_evidence (
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  PRIMARY KEY(assessment_id,observation_id)
);
CREATE INDEX assessments_job_history ON assessments(job_id,created_at);
