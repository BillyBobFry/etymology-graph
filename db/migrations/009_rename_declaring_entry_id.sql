DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'graph_edges'
      AND column_name = 'originating_entry_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'graph_edges'
      AND column_name = 'declaring_entry_id'
  ) THEN
    ALTER TABLE graph_edges
      RENAME COLUMN originating_entry_id TO declaring_entry_id;
  END IF;

  IF to_regclass('graph_edges_originating_entry_id_idx') IS NOT NULL
     AND to_regclass('graph_edges_declaring_entry_id_idx') IS NULL THEN
    ALTER INDEX graph_edges_originating_entry_id_idx
      RENAME TO graph_edges_declaring_entry_id_idx;
  END IF;

  IF to_regclass('graph_edges_from_type_origin_idx') IS NOT NULL
     AND to_regclass('graph_edges_from_type_declaring_idx') IS NULL THEN
    ALTER INDEX graph_edges_from_type_origin_idx
      RENAME TO graph_edges_from_type_declaring_idx;
  END IF;

  IF to_regclass('graph_edges_from_origin_type_idx') IS NOT NULL
     AND to_regclass('graph_edges_from_declaring_type_idx') IS NULL THEN
    ALTER INDEX graph_edges_from_origin_type_idx
      RENAME TO graph_edges_from_declaring_type_idx;
  END IF;
END $$;
