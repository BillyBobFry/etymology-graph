ALTER TABLE lexical_entries
  DROP COLUMN IF EXISTS pronunciations,
  DROP COLUMN IF EXISTS senses,
  DROP COLUMN IF EXISTS etymology_text;
