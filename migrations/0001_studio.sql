CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('post', 'work', 'talk', 'site')),
  frontmatter TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  base_sha TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS drafts_kind_slug_idx ON drafts(kind, slug);

CREATE TABLE IF NOT EXISTS pending_pings (
  url TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
