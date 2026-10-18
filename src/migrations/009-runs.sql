CREATE TABLE research_runs (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
 input_json TEXT NOT NULL, state_json TEXT NOT NULL,
 profile_version INTEGER NOT NULL REFERENCES profile_revisions(version)
);
CREATE TABLE run_operations (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL, input_json TEXT NOT NULL,
 PRIMARY KEY(run_id, operation_id)
);
