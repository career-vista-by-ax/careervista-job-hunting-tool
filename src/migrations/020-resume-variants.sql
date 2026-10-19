CREATE TABLE resume_variants (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL UNIQUE,
  base_resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  payload_id TEXT NOT NULL REFERENCES resume_payloads(id) ON DELETE CASCADE,
  parent_variant_id TEXT REFERENCES resume_variants(id),
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('resume','cover_letter','recommendations')),
  label TEXT NOT NULL,
  text TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  target_json TEXT NOT NULL,
  input_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX resume_variants_base ON resume_variants(base_resume_id,sequence);
