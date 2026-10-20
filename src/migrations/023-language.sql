CREATE TABLE user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE assessment_translations (
 id TEXT PRIMARY KEY,
 assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 language TEXT NOT NULL CHECK(language IN ('zh-CN','zh-Hant')),
 entries_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
