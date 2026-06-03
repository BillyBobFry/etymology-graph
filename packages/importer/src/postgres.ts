import type { Pool, PoolClient } from "pg";

import type { GraphEdge, GraphNode, LexicalEntry } from "@etymology-graph/graph";

export type GraphImportBatch = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lexicalEntries: LexicalEntry[];
};

export type GraphImportResult = {
  nodeCount: number;
  edgeCount: number;
  lexicalEntryCount: number;
};

export type GraphEdgeWalkRefreshPolicyInput = {
  limitRecords: number | undefined;
  refreshOverride: string | undefined;
};

/** Decides whether an import should rebuild the API read model; limited smoke runs should not pay this cost. */
export function shouldRefreshGraphEdgeWalkMaterializedView(input: GraphEdgeWalkRefreshPolicyInput): boolean {
  if (input.refreshOverride !== undefined) {
    return input.refreshOverride.trim().toLowerCase() === "true";
  }

  return input.limitRecords === undefined;
}

/** Refreshes the API edge read model after imports because graph endpoints read from the materialized view. */
export async function refreshGraphEdgeWalkMaterializedView(client: Pool | PoolClient): Promise<void> {
  await client.query("REFRESH MATERIALIZED VIEW graph_edge_walk_mv");
}

/** Upserts one previewed Wiktextract batch with bulk SQL so remote imports do not pay per-row latency. */
export async function upsertGraphBatch(client: PoolClient, batch: GraphImportBatch): Promise<GraphImportResult> {
  const nodes = dedupeById(batch.nodes);
  const edges = dedupeById(batch.edges);
  const lexicalEntries = dedupeById(batch.lexicalEntries);

  await client.query("BEGIN");

  try {
    await upsertNodes(client, nodes);
    await upsertLexicalEntries(client, lexicalEntries);

    await deleteStaleRootAncestryEdges(client, lexicalEntries);
    await upsertEdges(client, edges);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    lexicalEntryCount: lexicalEntries.length
  };
}

/** Writes graph nodes in one statement to keep database imports bounded by batch count. */
async function upsertNodes(client: PoolClient, nodes: GraphNode[]): Promise<void> {
  if (nodes.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO graph_nodes (id, lang_code, word, normalized_word, source)
      SELECT id, lang_code, word, normalized_word, 'wiktextract'
      FROM jsonb_to_recordset($1::jsonb) AS nodes(
        id TEXT,
        lang_code TEXT,
        word TEXT,
        normalized_word TEXT
      )
      ON CONFLICT (id) DO UPDATE SET
        lang_code = EXCLUDED.lang_code,
        word = EXCLUDED.word,
        normalized_word = EXCLUDED.normalized_word
    `,
    [
      JSON.stringify(
        nodes.map((node) => ({
          id: node.id,
          lang_code: node.langCode,
          word: node.word,
          normalized_word: node.normalizedWord
        }))
      )
    ]
  );
}

/** Writes lexical entries after nodes so entry-owned edges can reference them. */
async function upsertLexicalEntries(client: PoolClient, lexicalEntries: LexicalEntry[]): Promise<void> {
  if (lexicalEntries.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO lexical_entries (
        id,
        node_id,
        lang_code,
        word,
        normalized_word,
        pos,
        etymology_number,
        primary_ipa,
        primary_ipa_label,
        primary_gloss,
        pronunciations,
        senses,
        etymology_text,
        source_line_number,
        source_byte_offset,
        source
      )
      SELECT
        id,
        node_id,
        lang_code,
        word,
        normalized_word,
        pos,
        etymology_number,
        primary_ipa,
        primary_ipa_label,
        primary_gloss,
        pronunciations,
        senses,
        etymology_text,
        source_line_number,
        source_byte_offset,
        'wiktextract'
      FROM jsonb_to_recordset($1::jsonb) AS lexical_entries(
        id TEXT,
        node_id TEXT,
        lang_code TEXT,
        word TEXT,
        normalized_word TEXT,
        pos TEXT,
        etymology_number INTEGER,
        primary_ipa TEXT,
        primary_ipa_label TEXT,
        primary_gloss TEXT,
        pronunciations JSONB,
        senses JSONB,
        etymology_text TEXT,
        source_line_number INTEGER,
        source_byte_offset BIGINT
      )
      ON CONFLICT (id) DO UPDATE SET
        node_id = EXCLUDED.node_id,
        lang_code = EXCLUDED.lang_code,
        word = EXCLUDED.word,
        normalized_word = EXCLUDED.normalized_word,
        pos = EXCLUDED.pos,
        etymology_number = EXCLUDED.etymology_number,
        primary_ipa = EXCLUDED.primary_ipa,
        primary_ipa_label = EXCLUDED.primary_ipa_label,
        primary_gloss = EXCLUDED.primary_gloss,
        pronunciations = EXCLUDED.pronunciations,
        senses = EXCLUDED.senses,
        etymology_text = EXCLUDED.etymology_text,
        source_line_number = EXCLUDED.source_line_number,
        source_byte_offset = EXCLUDED.source_byte_offset
    `,
    [
      JSON.stringify(
        lexicalEntries.map((lexicalEntry) => ({
          id: lexicalEntry.id,
          node_id: lexicalEntry.nodeId,
          lang_code: lexicalEntry.langCode,
          word: lexicalEntry.word,
          normalized_word: lexicalEntry.normalizedWord,
          pos: lexicalEntry.pos ?? null,
          etymology_number: lexicalEntry.etymologyNumber ?? null,
          primary_ipa: lexicalEntry.primaryIpa ?? null,
          primary_ipa_label: lexicalEntry.primaryIpaLabel ?? null,
          primary_gloss: lexicalEntry.primaryGloss ?? null,
          pronunciations: lexicalEntry.pronunciations,
          senses: lexicalEntry.senses,
          etymology_text: lexicalEntry.etymologyText ?? null,
          source_line_number: lexicalEntry.sourceLineNumber ?? null,
          source_byte_offset: lexicalEntry.sourceByteOffset ?? null
        }))
      )
    ]
  );
}

/** Writes entry-attributed graph edges after stale edges for the same entries are removed. */
async function upsertEdges(client: PoolClient, edges: GraphEdge[]): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO graph_edges (
        id,
        from_node_id,
        to_node_id,
        edge_type,
        source,
        etymology_number,
        template_name,
        uncertain,
        declaring_entry_id
      )
      SELECT
        id,
        from_node_id,
        to_node_id,
        edge_type,
        'wiktextract',
        etymology_number,
        template_name,
        uncertain,
        declaring_entry_id
      FROM jsonb_to_recordset($1::jsonb) AS edges(
        id TEXT,
        from_node_id TEXT,
        to_node_id TEXT,
        edge_type TEXT,
        etymology_number INTEGER,
        template_name TEXT,
        uncertain BOOLEAN,
        declaring_entry_id TEXT
      )
      ON CONFLICT (id) DO UPDATE SET
        from_node_id = EXCLUDED.from_node_id,
        to_node_id = EXCLUDED.to_node_id,
        edge_type = EXCLUDED.edge_type,
        etymology_number = EXCLUDED.etymology_number,
        template_name = EXCLUDED.template_name,
        uncertain = EXCLUDED.uncertain,
        declaring_entry_id = EXCLUDED.declaring_entry_id
    `,
    [
      JSON.stringify(
        edges.map((edge) => ({
          id: edge.id,
          from_node_id: edge.fromNodeId,
          to_node_id: edge.toNodeId,
          edge_type: edge.type,
          etymology_number: edge.etymologyNumber ?? null,
          template_name: edge.templateName ?? null,
          uncertain: edge.uncertain ?? false,
          declaring_entry_id: edge.declaringEntryId
        }))
      )
    ]
  );
}

/** Keeps reimports from leaving obsolete ancestry edges behind without wiping edges declared by other entries. */
async function deleteStaleRootAncestryEdges(client: PoolClient, lexicalEntries: LexicalEntry[]): Promise<void> {
  const reimportedEntryIds = [...new Set(lexicalEntries.map((lexicalEntry) => lexicalEntry.id))];

  if (reimportedEntryIds.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM graph_edges
      WHERE source = 'wiktextract'
        AND declaring_entry_id = ANY($1::TEXT[])
    `,
    [reimportedEntryIds]
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
