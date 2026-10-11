-- Run once on the Cloudflare D1 database; never expose this database publicly.
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  ideal TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_created ON lessons(created_at, id);
