CREATE TABLE collection_plans (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL, input_hash TEXT NOT NULL, source TEXT NOT NULL,
 plan_json TEXT NOT NULL, UNIQUE(run_id,operation_id)
);
CREATE TABLE collection_events (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL, input_hash TEXT NOT NULL, search_key TEXT NOT NULL,
 outcome TEXT NOT NULL, found_count INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(run_id,operation_id)
);
CREATE TABLE collection_listings (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL REFERENCES collection_plans(id) ON DELETE CASCADE,
 search_key TEXT NOT NULL, work_key TEXT NOT NULL,
 source TEXT NOT NULL, url TEXT NOT NULL,
 job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
 PRIMARY KEY(run_id,work_key)
);
CREATE TABLE collection_captures (
 run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
 work_key TEXT NOT NULL, input_hash TEXT NOT NULL,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
 completion TEXT NOT NULL, destinations_json TEXT NOT NULL,
 PRIMARY KEY(run_id,work_key)
);
