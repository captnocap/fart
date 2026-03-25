-- Task Board Schema Extension
-- Additive — runs AFTER schema.sql
-- Adds: priority column, review/blocked statuses, steps, edits, notes

PRAGMA foreign_keys = ON;

-- Migrate tasks table to support review/blocked statuses + priority
-- SQLite can't ALTER CHECK constraints, so recreate the table
CREATE TABLE IF NOT EXISTS _tasks_migration AS SELECT * FROM tasks;

DROP TABLE IF EXISTS tasks;

CREATE TABLE tasks (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id         INTEGER NOT NULL REFERENCES projects(id),
    title              TEXT NOT NULL,
    spec_text          TEXT DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'backlog'
                       CHECK (status IN ('backlog', 'in-progress', 'review', 'done', 'blocked')),
    priority           INTEGER NOT NULL DEFAULT 50,
    assigned_worker_id INTEGER REFERENCES workers(id),
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Restore existing data
INSERT OR IGNORE INTO tasks (id, project_id, title, spec_text, status, assigned_worker_id, created_at, updated_at)
    SELECT id, project_id, title, spec_text, status, assigned_worker_id, created_at, updated_at
    FROM _tasks_migration;

DROP TABLE IF EXISTS _tasks_migration;

CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(project_id, priority);

-- Task steps: breakdown of work within a task
CREATE TABLE IF NOT EXISTS task_steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in-progress', 'done', 'blocked')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_steps_task ON task_steps(task_id, step_number);

-- Task edits: file changes logged per task
CREATE TABLE IF NOT EXISTS task_edits (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_id      INTEGER REFERENCES task_steps(id) ON DELETE SET NULL,
    worker_id    INTEGER REFERENCES workers(id),
    file_path    TEXT NOT NULL,
    edit_summary TEXT NOT NULL DEFAULT '',
    diff_snippet TEXT DEFAULT '',
    timestamp    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_edits_task ON task_edits(task_id, timestamp);

-- Task notes: discussion thread per task
CREATE TABLE IF NOT EXISTS task_notes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author    TEXT NOT NULL CHECK (author IN ('supervisor', 'worker', 'user')),
    content   TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_task ON task_notes(task_id, timestamp);
