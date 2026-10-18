CREATE TABLE sparse_diagnoses (
 id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE,
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 facts_json TEXT NOT NULL,
 explanation TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE sparse_saved_jobs (
 diagnosis_id TEXT NOT NULL REFERENCES sparse_diagnoses(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
 reasons_json TEXT NOT NULL,
 tracks_json TEXT NOT NULL,
 PRIMARY KEY(diagnosis_id,job_id)
);
CREATE TABLE sparse_search_proposals (
 id TEXT PRIMARY KEY,
 diagnosis_id TEXT NOT NULL REFERENCES sparse_diagnoses(id) ON DELETE CASCADE,
 submission_id TEXT NOT NULL UNIQUE,
 base_profile_version INTEGER NOT NULL REFERENCES profile_revisions(version),
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE sparse_search_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 proposal_id TEXT NOT NULL REFERENCES sparse_search_proposals(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 action TEXT NOT NULL CHECK(action IN ('accepted','rejected')),
 profile_version INTEGER REFERENCES profile_revisions(version),
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE TABLE preference_proposal_diagnoses (
 proposal_id TEXT PRIMARY KEY REFERENCES preference_proposals(id) ON DELETE CASCADE,
 diagnosis_id TEXT NOT NULL REFERENCES sparse_diagnoses(id) ON DELETE CASCADE
);
CREATE TRIGGER forget_diagnosis_proposals BEFORE DELETE ON sparse_saved_jobs
BEGIN
 DELETE FROM preference_proposals WHERE id IN (SELECT proposal_id FROM preference_proposal_diagnoses WHERE diagnosis_id=OLD.diagnosis_id);
END;
