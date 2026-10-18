CREATE TABLE reassessment_batches (
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,input_hash TEXT NOT NULL,
 profile_version INTEGER NOT NULL,track_id TEXT NOT NULL,budget_json TEXT NOT NULL,
 estimate_units INTEGER NOT NULL,selected_count INTEGER NOT NULL,created_at TEXT NOT NULL,
 actual_known_units INTEGER NOT NULL DEFAULT 0,completed_estimate_units INTEGER NOT NULL DEFAULT 0,
 unknown_estimate_units INTEGER NOT NULL DEFAULT 0,unknown_count INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(profile_version,track_id) REFERENCES search_tracks(profile_version,id) ON DELETE CASCADE
);
CREATE TABLE reassessment_items (
 id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES reassessment_batches(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,observation_ids_json TEXT NOT NULL,
 previous_assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','working','assessed','insufficient_evidence','provider_failure','malformed_output')),
 authorize_id TEXT,completion_id TEXT,completion_json TEXT,
 assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
 UNIQUE(batch_id,job_id)
);
