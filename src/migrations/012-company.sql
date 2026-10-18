CREATE TABLE company_research (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('request','report','summary','access')),
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX company_research_job ON company_research(job_id,sequence);
