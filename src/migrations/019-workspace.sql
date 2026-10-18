CREATE TABLE workspace_current (id INTEGER PRIMARY KEY CHECK (id=1), view_json TEXT NOT NULL);
CREATE TABLE workspace_views (id TEXT PRIMARY KEY, name TEXT NOT NULL, view_json TEXT NOT NULL);
