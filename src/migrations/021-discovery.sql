CREATE TABLE collection_candidates (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 work_key TEXT NOT NULL,
 plan_id TEXT NOT NULL REFERENCES collection_plans(id) ON DELETE CASCADE,
 search_key TEXT NOT NULL,
 source TEXT NOT NULL,
 url TEXT NOT NULL,
 preview_json TEXT NOT NULL,
 disposition TEXT NOT NULL DEFAULT 'pending' CHECK(disposition IN ('pending','selected','skipped')),
 reason TEXT,
 PRIMARY KEY(run_id, work_key)
);
CREATE TABLE collection_selections (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 PRIMARY KEY(run_id, operation_id)
);
