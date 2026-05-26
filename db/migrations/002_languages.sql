CREATE TABLE IF NOT EXISTS languages (
  code TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wiktionary',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
