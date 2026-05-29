CREATE INDEX IF NOT EXISTS lexical_entries_lang_id_idx
  ON lexical_entries (lang_code, id);
