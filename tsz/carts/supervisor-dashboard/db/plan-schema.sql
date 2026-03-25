-- Plan + Phase Schema Extension
-- Additive — runs AFTER task-schema.sql
-- Adds: plans, phases tables; extends tasks with phase_id and rich fields

PRAGMA foreign_keys = ON;

-- Plans: high-level goals broken into phases
CREATE TABLE IF NOT EXISTS plans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'abandoned')),
    goal            TEXT DEFAULT '',
    motivation      TEXT DEFAULT '',
    approach        TEXT DEFAULT '',
    constraints     TEXT DEFAULT '[]',
    non_goals       TEXT DEFAULT '[]',
    key_decisions   TEXT DEFAULT '[]',
    created_by      TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('supervisor', 'user')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id, status);

-- Phases: ordered groups of tasks within a plan
CREATE TABLE IF NOT EXISTS phases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id          INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    phase_number     INTEGER NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in-progress', 'done')),
    gate_description TEXT DEFAULT '',
    depends_on       TEXT DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_phases_plan ON phases(plan_id, phase_number);

-- Extend tasks: add phase_id + rich schema fields
-- Use ALTER TABLE to add columns (safe if they don't exist yet)

-- phase_id links a task to a phase (nullable — tasks can be standalone)
ALTER TABLE tasks ADD COLUMN phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN objective TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN context TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN known_exists TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN known_gaps TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN max_workers INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN file_boundaries TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN conflict_zones TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN blocked_by TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN visual_verification TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN changelog_entry TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN created_by TEXT NOT NULL DEFAULT 'user';

-- Extend task_steps: add files_touched and depends_on
ALTER TABLE task_steps ADD COLUMN files_touched TEXT DEFAULT '[]';
ALTER TABLE task_steps ADD COLUMN depends_on TEXT DEFAULT '[]';

-- Extend tasks status to include 'assigned'
-- SQLite can't alter CHECK constraints, but the existing CHECK already allows
-- the statuses we need (backlog, in-progress, review, done, blocked).
-- 'assigned' is new — we recreate if needed.
-- For safety, we skip the recreation if columns were just added (first run).

CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
