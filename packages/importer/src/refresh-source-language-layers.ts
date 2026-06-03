import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";

import {
  CURATED_SOURCE_LANGUAGE_ATLAS,
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type EdgeType
} from "@etymology-graph/graph";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const ANCESTOR_TRAVERSAL_EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "descendant_of"
] as const satisfies readonly EdgeType[];

const databaseUrl = process.env.DATABASE_URL;
const maxDepth = DEFAULT_ANCESTOR_MAX_DEPTH;
const batchSize = parsePositiveInteger(process.env.SOURCE_ATLAS_REFRESH_BATCH_SIZE, 50);
const requestedLangCodes = parseOptionalCodeSet(process.env.SOURCE_ATLAS_LANG_CODES);

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

try {
  const availableLanguageCodes = await loadAvailableLanguageCodes(pool);
  const pairs = curatedPairs()
    .filter((pair) => requestedLangCodes === undefined || requestedLangCodes.has(pair.langCode))
    .filter((pair) => availableLanguageCodes.has(pair.langCode) && availableLanguageCodes.has(pair.ancestorLangCode));

  console.log({
    maxDepth,
    batchSize,
    curatedPairs: pairs.length
  });

  for (const pair of pairs) {
    const client = await pool.connect();

    try {
      const refreshedCount = await refreshSourceLanguageLayerPair(client, pair);

      console.log({
        ...pair,
        maxDepth,
        refreshedCount
      });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}

type SourceLanguageLayerPair = {
  langCode: string;
  ancestorLangCode: string;
};

type RefreshBatchRow = {
  root_count: number;
  inserted_count: number;
  last_entry_id: string | null;
};

/** Parses an optional comma-separated language filter for targeted local refreshes. */
function parseOptionalCodeSet(rawValue: string | undefined): Set<string> | undefined {
  const codes = rawValue
    ?.split(",")
    .map((code) => code.trim())
    .filter((code) => code.length > 0);

  return codes && codes.length > 0 ? new Set(codes) : undefined;
}

/** Parses positive integer environment overrides while keeping unsafe values out of SQL limits. */
function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Flattens the curated atlas into concrete result/source language pairs. */
function curatedPairs(): SourceLanguageLayerPair[] {
  return CURATED_SOURCE_LANGUAGE_ATLAS.flatMap((language) =>
    language.sourceLayers.map((sourceLayer) => ({
      langCode: language.langCode,
      ancestorLangCode: sourceLayer.ancestorLangCode
    }))
  );
}

/** Loads language codes that can satisfy refresh-table foreign keys. */
async function loadAvailableLanguageCodes(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ code: string }>("SELECT code FROM languages");

  return new Set(result.rows.map((row) => row.code));
}

/** Replaces one curated pair's derived rows inside a transaction so empty pairs are recorded intentionally. */
async function refreshSourceLanguageLayerPair(
  client: PoolClient,
  pair: SourceLanguageLayerPair
): Promise<number> {
  await client.query("BEGIN");

  try {
    await client.query(
      `
        INSERT INTO source_language_layer_refreshes (lang_code, ancestor_lang_code, max_depth, refreshed_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (lang_code, ancestor_lang_code, max_depth) DO UPDATE SET
          refreshed_at = EXCLUDED.refreshed_at
      `,
      [pair.langCode, pair.ancestorLangCode, maxDepth]
    );

    await client.query(
      `
        DELETE FROM source_language_layer_matches
        WHERE lang_code = $1
          AND ancestor_lang_code = $2
          AND max_depth = $3
      `,
      [pair.langCode, pair.ancestorLangCode, maxDepth]
    );

    let cursor: string | undefined;
    let refreshedCount = 0;

    while (true) {
      const batch = await refreshSourceLanguageLayerBatch(client, pair, cursor);
      refreshedCount += batch.inserted_count;
      cursor = batch.last_entry_id ?? undefined;

      if (batch.root_count < batchSize || cursor === undefined) {
        break;
      }
    }

    await client.query(
      `
        UPDATE source_language_layer_refreshes
        SET refreshed_at = now()
        WHERE lang_code = $1
          AND ancestor_lang_code = $2
          AND max_depth = $3
      `,
      [pair.langCode, pair.ancestorLangCode, maxDepth]
    );

    await client.query("COMMIT");

    return refreshedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/** Computes and inserts one bounded root-entry page for a curated source-language pair. */
async function refreshSourceLanguageLayerBatch(
  client: PoolClient,
  pair: SourceLanguageLayerPair,
  cursor: string | undefined
): Promise<RefreshBatchRow> {
  const result = await client.query<RefreshBatchRow>(
    `
      WITH RECURSIVE
        root_entries AS (
          SELECT
            lexical_entries.id,
            lexical_entries.node_id
          FROM lexical_entries
          WHERE lexical_entries.lang_code = $1
            AND ($5::TEXT IS NULL OR lexical_entries.id > $5)
            AND EXISTS (
              SELECT 1
              FROM graph_edges root_edge
              WHERE root_edge.from_node_id = lexical_entries.node_id
                AND root_edge.declaring_entry_id = lexical_entries.id
                AND root_edge.edge_type = ANY($4::TEXT[])
            )
          ORDER BY lexical_entries.id
          LIMIT $6
        ),
        ancestor_walk AS (
          SELECT
            root_entries.id AS root_entry_id,
            root_entries.node_id AS node_id,
            0 AS depth,
            NULL::TEXT AS edge_id,
            ARRAY[root_entries.node_id] AS path,
            ARRAY[]::TEXT[] AS edge_path,
            root_entries.id AS allowed_entry_id,
            false AS reached_target
          FROM root_entries

          UNION ALL

          SELECT
            ancestor_walk.root_entry_id,
            next_edge.to_node_id AS node_id,
            ancestor_walk.depth + 1 AS depth,
            next_edge.id AS edge_id,
            ancestor_walk.path || next_edge.to_node_id AS path,
            ancestor_walk.edge_path || next_edge.id AS edge_path,
            current_allowed.allowed_entry_id AS allowed_entry_id,
            split_part(next_edge.to_node_id, ':', 1) = $2 AS reached_target
          FROM ancestor_walk
          CROSS JOIN LATERAL (
            SELECT COALESCE(
              (
                SELECT CASE
                  WHEN COUNT(*) = 1 THEN MIN(lexical_entries.id)
                  ELSE NULL
                END
                FROM lexical_entries
                WHERE lexical_entries.node_id = ancestor_walk.node_id
              ),
              ancestor_walk.allowed_entry_id
            ) AS allowed_entry_id
          ) current_allowed
          JOIN LATERAL (
            SELECT DISTINCT ON (candidate_edge.to_node_id)
              candidate_edge.id,
              candidate_edge.to_node_id
            FROM graph_edges candidate_edge
            WHERE candidate_edge.from_node_id = ancestor_walk.node_id
              AND candidate_edge.edge_type = ANY($4::TEXT[])
              AND candidate_edge.declaring_entry_id = current_allowed.allowed_entry_id
              AND NOT candidate_edge.to_node_id = ANY(ancestor_walk.path)
            ORDER BY candidate_edge.to_node_id, candidate_edge.id
          ) next_edge ON TRUE
          WHERE ancestor_walk.depth < $3
            AND NOT ancestor_walk.reached_target
        ),
        selected_matches AS (
          SELECT DISTINCT ON (root_entries.id)
            root_entries.id AS entry_id,
            ancestor_node.id AS matched_ancestor_node_id,
            ancestor_walk.depth,
            ancestor_walk.edge_path AS path_edge_ids
          FROM ancestor_walk
          JOIN root_entries
            ON root_entries.id = ancestor_walk.root_entry_id
          JOIN graph_nodes ancestor_node
            ON ancestor_node.id = ancestor_walk.node_id
          WHERE ancestor_walk.reached_target
          ORDER BY root_entries.id, ancestor_walk.depth, ancestor_node.normalized_word, ancestor_node.id
        ),
        inserted_matches AS (
          INSERT INTO source_language_layer_matches (
            lang_code,
            ancestor_lang_code,
            max_depth,
            entry_id,
            matched_ancestor_node_id,
            depth,
            path_edge_ids,
            refreshed_at
          )
          SELECT
            $1,
            $2,
            $3,
            selected_matches.entry_id,
            selected_matches.matched_ancestor_node_id,
            selected_matches.depth,
            selected_matches.path_edge_ids,
            now()
          FROM selected_matches
          ON CONFLICT (lang_code, ancestor_lang_code, max_depth, entry_id) DO UPDATE SET
            matched_ancestor_node_id = EXCLUDED.matched_ancestor_node_id,
            depth = EXCLUDED.depth,
            path_edge_ids = EXCLUDED.path_edge_ids,
            refreshed_at = EXCLUDED.refreshed_at
          RETURNING 1
        )
      SELECT
        (SELECT COUNT(*)::INTEGER FROM root_entries) AS root_count,
        (SELECT COUNT(*)::INTEGER FROM inserted_matches) AS inserted_count,
        (SELECT root_entries.id FROM root_entries ORDER BY root_entries.id DESC LIMIT 1) AS last_entry_id
    `,
    [
      pair.langCode,
      pair.ancestorLangCode,
      maxDepth,
      [...ANCESTOR_TRAVERSAL_EDGE_TYPES],
      cursor ?? null,
      batchSize
    ]
  );

  return result.rows[0] ?? { root_count: 0, inserted_count: 0, last_entry_id: null };
}
