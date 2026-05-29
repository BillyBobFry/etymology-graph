import type { PoolClient } from "pg";

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

export async function upsertGraphBatch(client: PoolClient, batch: GraphImportBatch): Promise<GraphImportResult> {
  const nodes = dedupeById(batch.nodes);
  const edges = dedupeById(batch.edges);
  const lexicalEntries = dedupeById(batch.lexicalEntries);

  await client.query("BEGIN");

  try {
    for (const node of nodes) {
      await client.query(
        `
          INSERT INTO graph_nodes (id, lang_code, word, normalized_word, source)
          VALUES ($1, $2, $3, $4, 'wiktextract')
          ON CONFLICT (id) DO UPDATE SET
            lang_code = EXCLUDED.lang_code,
            word = EXCLUDED.word,
            normalized_word = EXCLUDED.normalized_word
        `,
        [node.id, node.langCode, node.word, node.normalizedWord]
      );
    }

    for (const lexicalEntry of lexicalEntries) {
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, 'wiktextract')
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
          lexicalEntry.id,
          lexicalEntry.nodeId,
          lexicalEntry.langCode,
          lexicalEntry.word,
          lexicalEntry.normalizedWord,
          lexicalEntry.pos ?? null,
          lexicalEntry.etymologyNumber ?? null,
          lexicalEntry.primaryIpa ?? null,
          lexicalEntry.primaryIpaLabel ?? null,
          lexicalEntry.primaryGloss ?? null,
          JSON.stringify(lexicalEntry.pronunciations),
          JSON.stringify(lexicalEntry.senses),
          lexicalEntry.etymologyText ?? null,
          lexicalEntry.sourceLineNumber ?? null,
          lexicalEntry.sourceByteOffset ?? null
        ]
      );
    }

    await deleteStaleRootAncestryEdges(client, lexicalEntries);

    for (const edge of edges) {
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
            originating_entry_id
          )
          VALUES ($1, $2, $3, $4, 'wiktextract', $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            from_node_id = EXCLUDED.from_node_id,
            to_node_id = EXCLUDED.to_node_id,
            edge_type = EXCLUDED.edge_type,
            etymology_number = EXCLUDED.etymology_number,
            template_name = EXCLUDED.template_name,
            uncertain = EXCLUDED.uncertain,
            originating_entry_id = EXCLUDED.originating_entry_id
        `,
        [
          edge.id,
          edge.fromNodeId,
          edge.toNodeId,
          edge.type,
          edge.etymologyNumber ?? null,
          edge.templateName ?? null,
          edge.uncertain ?? false,
          edge.originatingEntryId
        ]
      );
    }

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
        AND originating_entry_id = ANY($1::TEXT[])
    `,
    [reimportedEntryIds]
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
