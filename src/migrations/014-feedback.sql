CREATE TABLE review_decisions (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 decision TEXT NOT NULL CHECK(decision IN ('saved','dismissed','unreviewed')),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE preference_proposals (
 id TEXT PRIMARY KEY,
 submission_id TEXT NOT NULL UNIQUE,
 base_profile_version INTEGER NOT NULL REFERENCES profile_revisions(version) ON DELETE CASCADE,
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE preference_proposal_feedback (
 proposal_id TEXT NOT NULL REFERENCES preference_proposals(id) ON DELETE CASCADE,
 decision_id TEXT NOT NULL REFERENCES review_decisions(id) ON DELETE CASCADE,
 PRIMARY KEY(proposal_id,decision_id)
);
CREATE TABLE preference_proposal_events (
 id TEXT PRIMARY KEY,
 proposal_id TEXT NOT NULL REFERENCES preference_proposals(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL UNIQUE,
 action TEXT NOT NULL CHECK(action IN ('accepted','rejected','reversed')),
 profile_version INTEGER REFERENCES profile_revisions(version) ON DELETE CASCADE,
 input_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TRIGGER forget_feedback_proposals BEFORE DELETE ON review_decisions
BEGIN
 DELETE FROM preference_proposals WHERE id IN (SELECT proposal_id FROM preference_proposal_feedback WHERE decision_id=OLD.id);
END;
