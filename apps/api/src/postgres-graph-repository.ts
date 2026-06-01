import type { Pool } from "pg";

import {
  canonicalGraphWord,
  EDGE_TYPES,
  normalizeWord,
  type AncestorPathQuery,
  type AncestorPathResult,
  type AncestorsQuery,
  type AncestorsResult,
  type ChildTermsQuery,
  type ChildTermsResult,
  type ComparisonSetQuery,
  type ComparisonSetResult,
  type DoubletGroup,
  type DoubletGroupsQuery,
  type DoubletGroupsResult,
  type DoubletsQuery,
  type DoubletsResult,
  type EdgeType,
  type EtymologyGraph,
  type GraphEdge,
  type GraphNode,
  type GraphTraversalNode,
  type Language,
  type LexicalSummary,
  type LanguagesResult,
  type SearchTermsQuery,
  type SearchTermsResult,
  type TermEntriesQuery,
  type TermEntriesResult,
  type TermEntrySummary,
  termEntrySummarySchema,
  type TermsWithAncestorLanguageMatch,
  type TermsWithAncestorLanguageQuery,
  type TermsWithAncestorLanguageResult
} from "@etymology-graph/graph";

import type { GraphRepository } from "./graph-repository.js";

const ANCESTOR_TRAVERSAL_EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "descendant_of"
] as const satisfies readonly EdgeType[];

const CHILD_TERM_EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "descendant_of"
] as const satisfies readonly EdgeType[];

const DOUBLET_TRAVERSAL_EDGE_TYPES = [
  "inherited_from",
  "derived_from",
  "borrowed_from"
] as const satisfies readonly EdgeType[];

type BaseNodeRow = {
  id: string;
  lang_code: string;
  lang_name: string | null;
  word: string;
  normalized_word: string;
  primary_ipa: string | null;
  primary_ipa_label: string | null;
  primary_gloss: string | null;
  primary_pos: string | null;
  entry_count: number | null;
};

type NodeRow = BaseNodeRow & {
  depth: number;
};

type EdgeRow = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  source: string;
  etymology_number: number | null;
  template_name: string | null;
  uncertain: boolean;
  originating_entry_id: string;
};

type ComparisonSetResolvedItem = ComparisonSetQuery["groups"][number]["items"][number] & {
  graph: EtymologyGraph | null;
};

type ComparisonSetResolvedGroup = {
  id: string;
  label: string;
  items: ComparisonSetResolvedItem[];
};

type LanguageRow = {
  code: string;
  canonical_name: string;
};

type TermEntryRow = {
  id: string;
  node_id: string;
  lang_code: string;
  word: string;
  normalized_word: string;
  pos: string | null;
  etymology_number: number | null;
  primary_ipa: string | null;
  primary_ipa_label: string | null;
  primary_gloss: string | null;
};

type TermsWithAncestorLanguageRow = {
  entry_id: string;
  entry_node_id: string;
  entry_lang_code: string;
  entry_word: string;
  entry_normalized_word: string;
  entry_pos: string | null;
  entry_etymology_number: number | null;
  entry_primary_ipa: string | null;
  entry_primary_ipa_label: string | null;
  entry_primary_gloss: string | null;
  node_lang_name: string | null;
  node_entry_count: number | null;
  ancestor_id: string;
  ancestor_lang_code: string;
  ancestor_lang_name: string | null;
  ancestor_word: string;
  ancestor_normalized_word: string;
  ancestor_primary_ipa: string | null;
  ancestor_primary_ipa_label: string | null;
  ancestor_primary_gloss: string | null;
  ancestor_primary_pos: string | null;
  ancestor_entry_count: number | null;
  depth: number;
  path_edge_ids: string[];
};

type DoubletGroupRow = BaseNodeRow & {
  member_count: number;
  min_depth: number;
  entry_summaries: unknown;
};

const ancestorLanguageRootPageSize = 250;
const ancestorLanguageMaxRootPages = 20;

type DoubletGroupsCursor = {
  entryCount: number;
  ancestorId: string;
};

const doubletGroupEntriesSchema = termEntrySummarySchema.array();

/** Inline subquery that summarises lexical metadata for a graph node, reused by every node-returning query. */
const LEXICAL_SUMMARY_LATERAL_SQL = `
  LEFT JOIN LATERAL (
    SELECT
      (ARRAY_AGG(primary_ipa ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
        FILTER (WHERE primary_ipa IS NOT NULL AND primary_ipa <> ''))[1] AS primary_ipa,
      (ARRAY_AGG(primary_ipa_label ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
        FILTER (WHERE primary_ipa_label IS NOT NULL AND primary_ipa_label <> ''))[1] AS primary_ipa_label,
      (ARRAY_AGG(primary_gloss ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
        FILTER (WHERE primary_gloss IS NOT NULL AND primary_gloss <> ''))[1] AS primary_gloss,
      (ARRAY_AGG(pos ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
        FILTER (WHERE pos IS NOT NULL AND pos <> ''))[1] AS primary_pos,
      COUNT(*)::INTEGER AS entry_count
    FROM lexical_entries
    WHERE lexical_entries.node_id = graph_nodes.id
  ) lexical_summary ON TRUE
`;

const EDGE_COLUMN_LIST = `
  graph_edges.id,
  graph_edges.from_node_id,
  graph_edges.to_node_id,
  graph_edges.edge_type,
  graph_edges.source,
  graph_edges.etymology_number,
  graph_edges.template_name,
  graph_edges.uncertain,
  graph_edges.originating_entry_id
`;

/**
 * Selects the seed graph node that anchors a traversal, plus the lexical entry chosen for entry-aware
 * filtering when one exists. The explicit pos / etymologyNumber filter (case set by the caller) picks
 * exactly one entry; otherwise the lowest etymology number with the alphabetically-first POS is used so
 * the same default is stable across requests. When the term has no imported lexical entry the entry_id
 * column is `NULL`, which disables the originating-entry filter on the walk so terms found only as
 * intermediate graph nodes (proto-forms, deeper unmapped ancestors) still resolve.
 */
const ANCHOR_ENTRY_CTE_SQL = `
  anchor_entry AS (
    SELECT
      lexical_entries.id AS entry_id,
      lexical_entries.node_id AS node_id
    FROM lexical_entries
    WHERE lexical_entries.lang_code = $1
      AND lexical_entries.normalized_word = $2
      AND ($5::TEXT IS NULL OR lexical_entries.pos = $5)
      AND ($6::INTEGER IS NULL OR COALESCE(lexical_entries.etymology_number, 0) = $6)
    ORDER BY
      lexical_entries.etymology_number ASC NULLS FIRST,
      lexical_entries.pos ASC NULLS FIRST,
      lexical_entries.id ASC
    LIMIT 1
  ),
  anchor_resolved AS (
    SELECT entry_id, node_id FROM anchor_entry
    UNION ALL
    SELECT NULL::TEXT AS entry_id, graph_nodes.id AS node_id
    FROM graph_nodes
    WHERE graph_nodes.lang_code = $1
      AND graph_nodes.normalized_word = $2
      AND NOT EXISTS (SELECT 1 FROM anchor_entry)
    LIMIT 1
  )
`;

/**
 * Recursive CTE that walks ancestor edges away from the seed entry while only following edges whose
 * originating entry is currently in the allowed set. The allowed set is seeded with the anchor entry
 * and expands at each visited node when another homed entry agrees with the seed (case b) or is the
 * only entry homed at the node (case a). Descendant-tree edges from another source page may also bridge
 * single-entry nodes when the entry's own evidence does not already cover that target language, matching
 * the pure `traverseAncestors` reference function.
 */
const ANCESTOR_WALK_CTE_SQL = `
  ancestor_walk AS (
    SELECT
      anchor_resolved.node_id AS node_id,
      0 AS depth,
      NULL::TEXT AS edge_id,
      ARRAY[anchor_resolved.node_id] AS path,
      ARRAY[]::TEXT[] AS edge_path,
      CASE
        WHEN anchor_resolved.entry_id IS NULL THEN ARRAY[]::TEXT[]
        ELSE ARRAY[anchor_resolved.entry_id]::TEXT[]
      END AS allowed_entry_ids,
      anchor_resolved.entry_id IS NOT NULL AS entry_scoped
    FROM anchor_resolved

    UNION ALL

    SELECT
      next_edge.to_node_id AS node_id,
      ancestor_walk.depth + 1 AS depth,
      next_edge.id AS edge_id,
      ancestor_walk.path || next_edge.to_node_id AS path,
      ancestor_walk.edge_path || next_edge.id AS edge_path,
      current_allowed.allowed_entry_ids AS allowed_entry_ids,
      ancestor_walk.entry_scoped AS entry_scoped
    FROM ancestor_walk
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN NOT ancestor_walk.entry_scoped THEN ARRAY[]::TEXT[]
          ELSE ancestor_walk.allowed_entry_ids || COALESCE((
            SELECT ARRAY_AGG(candidate.id)
            FROM lexical_entries candidate
            WHERE candidate.node_id = ancestor_walk.node_id
              AND NOT candidate.id = ANY(ancestor_walk.allowed_entry_ids)
              AND (
                (
                  SELECT COUNT(*) FROM lexical_entries
                  WHERE lexical_entries.node_id = ancestor_walk.node_id
                ) = 1
                OR EXISTS (
                  SELECT 1
                  FROM graph_edges adopt_edge
                  JOIN graph_edges seed_edge
                    ON seed_edge.from_node_id = adopt_edge.from_node_id
                    AND seed_edge.to_node_id = adopt_edge.to_node_id
                    AND seed_edge.edge_type = ANY($4::TEXT[])
                    AND seed_edge.originating_entry_id = ANY(ancestor_walk.allowed_entry_ids)
                  WHERE adopt_edge.originating_entry_id = candidate.id
                    AND adopt_edge.from_node_id = ancestor_walk.node_id
                    AND adopt_edge.edge_type = ANY($4::TEXT[])
                )
              )
          ), ARRAY[]::TEXT[])
        END AS allowed_entry_ids
    ) current_allowed
    JOIN graph_edges next_edge
      ON next_edge.from_node_id = ancestor_walk.node_id
    WHERE ancestor_walk.depth < $3
      AND next_edge.edge_type = ANY($4::TEXT[])
      AND (
        NOT ancestor_walk.entry_scoped
        OR next_edge.originating_entry_id = ANY(current_allowed.allowed_entry_ids)
        OR (
          next_edge.template_name = 'descendants'
          AND (
            SELECT COUNT(*)
            FROM lexical_entries
            WHERE lexical_entries.node_id = ancestor_walk.node_id
          ) <= 1
          AND NOT EXISTS (
            SELECT 1
            FROM graph_edges own_edge
            WHERE own_edge.from_node_id = ancestor_walk.node_id
              AND own_edge.edge_type = ANY($4::TEXT[])
              AND own_edge.originating_entry_id = ANY(current_allowed.allowed_entry_ids)
              AND split_part(own_edge.to_node_id, ':', 1) = split_part(next_edge.to_node_id, ':', 1)
          )
        )
      )
      AND NOT next_edge.to_node_id = ANY(ancestor_walk.path)
  )
`;

export class PostgresGraphRepository implements GraphRepository {
  public constructor(private readonly pool: Pool) {}

  /** Lists imported languages so clients can scope term search before querying nodes. */
  public async listLanguages(): Promise<LanguagesResult> {
    const result = await this.pool.query<LanguageRow>(
      `
        SELECT
          code,
          canonical_name
        FROM languages
        ORDER BY canonical_name, code
      `
    );

    return {
      languages: result.rows.map(mapLanguageRow)
    };
  }

  /** Finds candidate term nodes by normalized word while keeping search SQL out of handlers. */
  public async searchTerms(query: SearchTermsQuery): Promise<SearchTermsResult> {
    const normalizedQuery = query.langCode
      ? normalizeCanonicalGraphWord(query.langCode, query.query)
      : normalizeWord(query.query);

    if (!normalizedQuery) {
      return {
        query: query.query,
        results: []
      };
    }

    const escapedQuery = escapeLikePattern(normalizedQuery);
    const containsPattern = `%${escapedQuery}%`;
    const prefixPattern = `${escapedQuery}%`;
    const result = await this.pool.query<BaseNodeRow>(
      `
        SELECT
          graph_nodes.id,
          graph_nodes.lang_code,
          languages.canonical_name AS lang_name,
          graph_nodes.word,
          graph_nodes.normalized_word,
          lexical_summary.primary_ipa,
          lexical_summary.primary_ipa_label,
          lexical_summary.primary_gloss,
          lexical_summary.primary_pos,
          lexical_summary.entry_count
        FROM graph_nodes
        LEFT JOIN languages
          ON languages.code = graph_nodes.lang_code
        ${LEXICAL_SUMMARY_LATERAL_SQL}
        WHERE graph_nodes.normalized_word LIKE $1 ESCAPE E'\\\\'
          AND ($2::TEXT IS NULL OR graph_nodes.lang_code = $2)
        ORDER BY
          CASE
            WHEN graph_nodes.normalized_word = $3 THEN 0
            WHEN graph_nodes.normalized_word LIKE $4 ESCAPE E'\\\\' THEN 1
            ELSE 2
          END,
          graph_nodes.lang_code,
          graph_nodes.normalized_word,
          graph_nodes.word
        LIMIT $5
      `,
      [containsPattern, query.langCode ?? null, normalizedQuery, prefixPattern, query.limit]
    );

    return {
      query: query.query,
      results: result.rows.map(mapBaseNodeRow)
    };
  }

  /** Lists every lexical entry homed at a term so the frontend can pick which etymological story to follow. */
  public async listTermEntries(query: TermEntriesQuery): Promise<TermEntriesResult> {
    const normalizedWord = normalizeCanonicalGraphWord(query.langCode, query.word);
    const result = await this.pool.query<TermEntryRow>(
      `
        SELECT
          lexical_entries.id,
          lexical_entries.node_id,
          lexical_entries.lang_code,
          lexical_entries.word,
          lexical_entries.normalized_word,
          lexical_entries.pos,
          lexical_entries.etymology_number,
          lexical_entries.primary_ipa,
          lexical_entries.primary_ipa_label,
          lexical_entries.primary_gloss
        FROM lexical_entries
        WHERE lexical_entries.lang_code = $1
          AND lexical_entries.normalized_word = $2
        ORDER BY
          lexical_entries.etymology_number ASC NULLS FIRST,
          lexical_entries.pos ASC NULLS FIRST,
          lexical_entries.id ASC
      `,
      [query.langCode, normalizedWord]
    );

    return {
      entries: result.rows.map(mapTermEntryRow)
    };
  }

  /**
   * Finds entries in one language whose entry-aware ancestor chain reaches another language. This first
   * version pages matched entries directly for a clean API contract; if it becomes slow at larger scale,
   * replace the recursive search with materialized reachability while preserving the result cursor shape.
   */
  public async findTermsWithAncestorLanguage(
    query: TermsWithAncestorLanguageQuery
  ): Promise<TermsWithAncestorLanguageResult> {
    const visibleRows: TermsWithAncestorLanguageRow[] = [];
    let cursor = query.cursor;
    let nextCursor: string | undefined;

    for (
      let pageIndex = 0;
      pageIndex < ancestorLanguageMaxRootPages && visibleRows.length < query.limit;
      pageIndex += 1
    ) {
      const rootPage = await this.pool.query<{ id: string }>(
        `
          SELECT id
          FROM lexical_entries
          WHERE lang_code = $1
            AND ($2::TEXT IS NULL OR id > $2)
          ORDER BY id
          LIMIT $3
        `,
        [query.langCode, cursor ?? null, ancestorLanguageRootPageSize]
      );

      if (rootPage.rows.length === 0) {
        nextCursor = undefined;
        break;
      }

      const rootEntryIds = rootPage.rows.map((row) => row.id);
      cursor = rootEntryIds[rootEntryIds.length - 1];
      nextCursor = rootPage.rows.length === ancestorLanguageRootPageSize ? cursor : undefined;

      const result = await this.pool.query<TermsWithAncestorLanguageRow>(
        `
          WITH RECURSIVE
            root_entries AS (
              SELECT
                lexical_entries.id,
                lexical_entries.node_id,
                lexical_entries.lang_code,
                lexical_entries.word,
                lexical_entries.normalized_word,
                lexical_entries.pos,
                lexical_entries.etymology_number,
                lexical_entries.primary_ipa,
                lexical_entries.primary_ipa_label,
                lexical_entries.primary_gloss
              FROM lexical_entries
              WHERE lexical_entries.id = ANY($4::TEXT[])
            ),
            ancestor_walk AS (
              SELECT
                root_entries.id AS root_entry_id,
                root_entries.node_id AS node_id,
                0 AS depth,
                NULL::TEXT AS edge_id,
                ARRAY[root_entries.node_id] AS path,
                ARRAY[]::TEXT[] AS edge_path,
                ARRAY[root_entries.id]::TEXT[] AS allowed_entry_ids
              FROM root_entries

              UNION ALL

              SELECT
                ancestor_walk.root_entry_id,
                next_edge.to_node_id AS node_id,
                ancestor_walk.depth + 1 AS depth,
                next_edge.id AS edge_id,
                ancestor_walk.path || next_edge.to_node_id AS path,
                ancestor_walk.edge_path || next_edge.id AS edge_path,
                current_allowed.allowed_entry_ids AS allowed_entry_ids
              FROM ancestor_walk
              CROSS JOIN LATERAL (
                SELECT ancestor_walk.allowed_entry_ids || COALESCE((
                  SELECT ARRAY_AGG(candidate.id)
                  FROM lexical_entries candidate
                  WHERE candidate.node_id = ancestor_walk.node_id
                    AND NOT candidate.id = ANY(ancestor_walk.allowed_entry_ids)
                    AND (
                      (
                        SELECT COUNT(*) FROM lexical_entries
                        WHERE lexical_entries.node_id = ancestor_walk.node_id
                      ) = 1
                      OR EXISTS (
                        SELECT 1
                        FROM graph_edges adopt_edge
                        JOIN graph_edges seed_edge
                          ON seed_edge.from_node_id = adopt_edge.from_node_id
                          AND seed_edge.to_node_id = adopt_edge.to_node_id
                          AND seed_edge.edge_type = ANY($3::TEXT[])
                          AND seed_edge.originating_entry_id = ANY(ancestor_walk.allowed_entry_ids)
                        WHERE adopt_edge.originating_entry_id = candidate.id
                          AND adopt_edge.from_node_id = ancestor_walk.node_id
                          AND adopt_edge.edge_type = ANY($3::TEXT[])
                      )
                    )
                ), ARRAY[]::TEXT[]) AS allowed_entry_ids
              ) current_allowed
              JOIN graph_edges next_edge
                ON next_edge.from_node_id = ancestor_walk.node_id
              WHERE ancestor_walk.depth < $2
                AND next_edge.edge_type = ANY($3::TEXT[])
                AND next_edge.originating_entry_id = ANY(current_allowed.allowed_entry_ids)
                AND NOT next_edge.to_node_id = ANY(ancestor_walk.path)
            ),
            selected_matches AS (
              SELECT DISTINCT ON (root_entries.id)
                root_entries.id AS entry_id,
                root_entries.node_id AS entry_node_id,
                root_entries.lang_code AS entry_lang_code,
                root_entries.word AS entry_word,
                root_entries.normalized_word AS entry_normalized_word,
                root_entries.pos AS entry_pos,
                root_entries.etymology_number AS entry_etymology_number,
                root_entries.primary_ipa AS entry_primary_ipa,
                root_entries.primary_ipa_label AS entry_primary_ipa_label,
                root_entries.primary_gloss AS entry_primary_gloss,
                node_language.canonical_name AS node_lang_name,
                (
                  SELECT COUNT(*)::INTEGER
                  FROM lexical_entries node_entry_count
                  WHERE node_entry_count.node_id = root_entries.node_id
                ) AS node_entry_count,
                ancestor_node.id AS ancestor_id,
                ancestor_node.lang_code AS ancestor_lang_code,
                ancestor_language.canonical_name AS ancestor_lang_name,
                ancestor_node.word AS ancestor_word,
                ancestor_node.normalized_word AS ancestor_normalized_word,
                ancestor_summary.primary_ipa AS ancestor_primary_ipa,
                ancestor_summary.primary_ipa_label AS ancestor_primary_ipa_label,
                ancestor_summary.primary_gloss AS ancestor_primary_gloss,
                ancestor_summary.primary_pos AS ancestor_primary_pos,
                ancestor_summary.entry_count AS ancestor_entry_count,
                ancestor_walk.depth,
                ancestor_walk.edge_path AS path_edge_ids
              FROM ancestor_walk
              JOIN root_entries
                ON root_entries.id = ancestor_walk.root_entry_id
              JOIN graph_nodes ancestor_node
                ON ancestor_node.id = ancestor_walk.node_id
                AND ancestor_node.lang_code = $1
              LEFT JOIN languages node_language
                ON node_language.code = root_entries.lang_code
              LEFT JOIN languages ancestor_language
                ON ancestor_language.code = ancestor_node.lang_code
              LEFT JOIN LATERAL (
                SELECT
                  (ARRAY_AGG(primary_ipa ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
                    FILTER (WHERE primary_ipa IS NOT NULL AND primary_ipa <> ''))[1] AS primary_ipa,
                  (ARRAY_AGG(primary_ipa_label ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
                    FILTER (WHERE primary_ipa_label IS NOT NULL AND primary_ipa_label <> ''))[1] AS primary_ipa_label,
                  (ARRAY_AGG(primary_gloss ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
                    FILTER (WHERE primary_gloss IS NOT NULL AND primary_gloss <> ''))[1] AS primary_gloss,
                  (ARRAY_AGG(pos ORDER BY etymology_number NULLS LAST, pos NULLS LAST)
                    FILTER (WHERE pos IS NOT NULL AND pos <> ''))[1] AS primary_pos,
                  COUNT(*)::INTEGER AS entry_count
                FROM lexical_entries
                WHERE lexical_entries.node_id = ancestor_node.id
              ) ancestor_summary ON TRUE
              WHERE ancestor_walk.depth > 0
              ORDER BY root_entries.id, ancestor_walk.depth, ancestor_node.lang_code, ancestor_node.normalized_word
            )
          SELECT *
          FROM selected_matches
          ORDER BY entry_id
        `,
        [
          query.ancestorLangCode,
          query.maxDepth,
          [...ANCESTOR_TRAVERSAL_EDGE_TYPES],
          rootEntryIds
        ]
      );

      visibleRows.push(...result.rows.slice(0, query.limit - visibleRows.length));

      if (nextCursor === undefined) {
        break;
      }
    }

    return {
      matches: visibleRows.map(mapTermsWithAncestorLanguageRow),
      nextCursor
    };
  }

  /** Finds source terms for a term using an entry-aware recursive walk to avoid crossing homograph histories. */
  public async findAncestors(query: AncestorsQuery): Promise<AncestorsResult> {
    const params = buildAnchorParams(query, query.maxDepth, ANCESTOR_TRAVERSAL_EDGE_TYPES);

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            node_depths AS (
              SELECT
                node_id,
                MIN(depth) AS depth
              FROM ancestor_walk
              GROUP BY node_id
            )
          SELECT
            graph_nodes.id,
            graph_nodes.lang_code,
            languages.canonical_name AS lang_name,
            graph_nodes.word,
            graph_nodes.normalized_word,
            lexical_summary.primary_ipa,
            lexical_summary.primary_ipa_label,
            lexical_summary.primary_gloss,
            lexical_summary.primary_pos,
            lexical_summary.entry_count,
            node_depths.depth
          FROM node_depths
          JOIN graph_nodes
            ON graph_nodes.id = node_depths.node_id
          LEFT JOIN languages
            ON languages.code = graph_nodes.lang_code
          ${LEXICAL_SUMMARY_LATERAL_SQL}
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        params
      ),
      this.pool.query<EdgeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            traversed_edges AS (
              SELECT DISTINCT edge_id
              FROM ancestor_walk
              WHERE edge_id IS NOT NULL
            )
          SELECT
            ${EDGE_COLUMN_LIST}
          FROM traversed_edges
          JOIN graph_edges
            ON graph_edges.id = traversed_edges.edge_id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        params
      )
    ]);

    if (nodeResult.rows.length === 0) {
      return { graph: null };
    }

    const rootNode = nodeResult.rows.find((row) => row.depth === 0);

    if (!rootNode) {
      throw new Error("Ancestor query returned no root node");
    }

    return {
      graph: {
        rootNodeId: rootNode.id,
        nodes: nodeResult.rows.map(mapNodeRow),
        edges: edgeResult.rows.map(mapEdgeRow),
        maxDepth: query.maxDepth
      }
    };
  }

  /** Finds only the entry-aware path between a selected term and a selected ancestor, excluding sibling branches. */
  public async findAncestorPath(query: AncestorPathQuery): Promise<AncestorPathResult> {
    const params = [
      ...buildAnchorParams(query, query.maxDepth, ANCESTOR_TRAVERSAL_EDGE_TYPES),
      query.ancestorLangCode,
      normalizeCanonicalGraphWord(query.ancestorLangCode, query.ancestorWord)
    ];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            selected_path AS (
              SELECT
                ancestor_walk.path,
                ancestor_walk.edge_path,
                ancestor_walk.depth
              FROM ancestor_walk
              JOIN graph_nodes target_node
                ON target_node.id = ancestor_walk.node_id
              WHERE ancestor_walk.depth > 0
                AND target_node.lang_code = $7
                AND target_node.normalized_word = $8
              ORDER BY ancestor_walk.depth ASC, target_node.id ASC
              LIMIT 1
            ),
            path_nodes AS (
              SELECT
                path_node.node_id,
                (path_node.path_index - 1)::INTEGER AS depth
              FROM selected_path
              CROSS JOIN LATERAL UNNEST(selected_path.path) WITH ORDINALITY AS path_node(node_id, path_index)
            )
          SELECT
            graph_nodes.id,
            graph_nodes.lang_code,
            languages.canonical_name AS lang_name,
            graph_nodes.word,
            graph_nodes.normalized_word,
            lexical_summary.primary_ipa,
            lexical_summary.primary_ipa_label,
            lexical_summary.primary_gloss,
            lexical_summary.primary_pos,
            lexical_summary.entry_count,
            path_nodes.depth
          FROM path_nodes
          JOIN graph_nodes
            ON graph_nodes.id = path_nodes.node_id
          LEFT JOIN languages
            ON languages.code = graph_nodes.lang_code
          ${LEXICAL_SUMMARY_LATERAL_SQL}
          ORDER BY path_nodes.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        params
      ),
      this.pool.query<EdgeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            selected_path AS (
              SELECT
                ancestor_walk.edge_path,
                ancestor_walk.depth
              FROM ancestor_walk
              JOIN graph_nodes target_node
                ON target_node.id = ancestor_walk.node_id
              WHERE ancestor_walk.depth > 0
                AND target_node.lang_code = $7
                AND target_node.normalized_word = $8
              ORDER BY ancestor_walk.depth ASC, target_node.id ASC
              LIMIT 1
            ),
            path_edges AS (
              SELECT path_edge.edge_id
              FROM selected_path
              CROSS JOIN LATERAL UNNEST(selected_path.edge_path) WITH ORDINALITY AS path_edge(edge_id, path_index)
            )
          SELECT
            ${EDGE_COLUMN_LIST}
          FROM path_edges
          JOIN graph_edges
            ON graph_edges.id = path_edges.edge_id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        params
      )
    ]);

    if (nodeResult.rows.length === 0) {
      return { graph: null };
    }

    const rootNode = nodeResult.rows.find((row) => row.depth === 0);

    if (!rootNode) {
      throw new Error("Ancestor path query returned no root node");
    }

    return {
      graph: {
        rootNodeId: rootNode.id,
        nodes: nodeResult.rows.map(mapNodeRow),
        edges: edgeResult.rows.map(mapEdgeRow),
        maxDepth: query.maxDepth
      }
    };
  }

  /** Builds a curated set of cognate path graphs from one source form to grouped comparison terms. */
  public async findComparisonSet(query: ComparisonSetQuery): Promise<ComparisonSetResult> {
    const groupsWithGraphs = await Promise.all(
      query.groups.map(async (group) => {
        const items = await Promise.all(
          group.items.map(async (item) => {
            const result = await this.findAncestorPath({
              langCode: item.langCode,
              word: item.word,
              ancestorLangCode: query.root.langCode,
              ancestorWord: query.root.word,
              maxDepth: query.maxDepth,
              pos: item.pos,
              etymologyNumber: item.etymologyNumber
            });

            return {
              ...item,
              graph: result.graph
            };
          })
        );

        return {
          id: group.id,
          label: group.label,
          items
        };
      })
    );
    const root = findComparisonSetRoot(query, groupsWithGraphs);

    return {
      root,
      graph: mergeComparisonSetGraphs(query, groupsWithGraphs, root),
      groups: groupsWithGraphs.map((group) => ({
        id: group.id,
        label: group.label,
        items: group.items.map(({ graph: _graph, ...item }) => item)
      }))
    };
  }

  /**
   * Finds direct descendants of the seed term. Includes edges declared by the seed's own descendants list,
   * edges self-declared by descendant entries homed at the candidate child node, and (when the seed has
   * no imported lexical entry) every incoming edge so proto-forms and other unmapped graph nodes still
   * surface descendants.
   */
  public async findChildTerms(query: ChildTermsQuery): Promise<ChildTermsResult> {
    const params = [
      query.langCode,
      normalizeCanonicalGraphWord(query.langCode, query.word),
      query.limit,
      [...CHILD_TERM_EDGE_TYPES],
      query.pos ?? null,
      query.etymologyNumber ?? null
    ];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH
            ${ANCHOR_ENTRY_CTE_SQL},
            child_edges AS (
              SELECT graph_edges.id, graph_edges.from_node_id, graph_edges.to_node_id
              FROM graph_edges
              JOIN anchor_resolved
                ON anchor_resolved.node_id = graph_edges.to_node_id
              LEFT JOIN lexical_entries owner_entry
                ON owner_entry.id = graph_edges.originating_entry_id
              WHERE graph_edges.edge_type = ANY($4::TEXT[])
                AND (
                  anchor_resolved.entry_id IS NULL
                  OR graph_edges.originating_entry_id = anchor_resolved.entry_id
                  OR owner_entry.node_id = graph_edges.from_node_id
                )
              ORDER BY graph_edges.from_node_id
              LIMIT $3
            ),
            node_depths AS (
              SELECT anchor_resolved.node_id AS node_id, 0 AS depth FROM anchor_resolved
              UNION ALL
              SELECT DISTINCT child_edges.from_node_id AS node_id, 1 AS depth FROM child_edges
            )
          SELECT
            graph_nodes.id,
            graph_nodes.lang_code,
            languages.canonical_name AS lang_name,
            graph_nodes.word,
            graph_nodes.normalized_word,
            lexical_summary.primary_ipa,
            lexical_summary.primary_ipa_label,
            lexical_summary.primary_gloss,
            lexical_summary.primary_pos,
            lexical_summary.entry_count,
            node_depths.depth
          FROM node_depths
          JOIN graph_nodes
            ON graph_nodes.id = node_depths.node_id
          LEFT JOIN languages
            ON languages.code = graph_nodes.lang_code
          ${LEXICAL_SUMMARY_LATERAL_SQL}
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        params
      ),
      this.pool.query<EdgeRow>(
        `
          WITH
            ${ANCHOR_ENTRY_CTE_SQL},
            child_edges AS (
              SELECT graph_edges.id
              FROM graph_edges
              JOIN anchor_resolved
                ON anchor_resolved.node_id = graph_edges.to_node_id
              LEFT JOIN lexical_entries owner_entry
                ON owner_entry.id = graph_edges.originating_entry_id
              WHERE graph_edges.edge_type = ANY($4::TEXT[])
                AND (
                  anchor_resolved.entry_id IS NULL
                  OR graph_edges.originating_entry_id = anchor_resolved.entry_id
                  OR owner_entry.node_id = graph_edges.from_node_id
                )
              ORDER BY graph_edges.from_node_id
              LIMIT $3
            )
          SELECT
            ${EDGE_COLUMN_LIST}
          FROM child_edges
          JOIN graph_edges
            ON graph_edges.id = child_edges.id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        params
      )
    ]);

    if (nodeResult.rows.length <= 1 || edgeResult.rows.length === 0) {
      return { graph: null };
    }

    const rootNode = nodeResult.rows.find((row) => row.depth === 0);

    if (!rootNode) {
      throw new Error("Child terms query returned no root node");
    }

    return {
      graph: {
        rootNodeId: rootNode.id,
        nodes: nodeResult.rows.map(mapNodeRow),
        edges: edgeResult.rows.map(mapEdgeRow),
        maxDepth: 1
      }
    };
  }

  /**
   * Lists same-language doublet clusters by grouping entries that reach the same entry-aware ancestor.
   * The response keeps each group bounded with a sample of entries so broad ancestor hubs do not dominate
   * the payload before the UI asks for a focused graph.
   */
  public async findDoubletGroups(query: DoubletGroupsQuery): Promise<DoubletGroupsResult> {
    const resultLimit = query.limit + 1;
    const cursor = parseDoubletGroupsCursor(query.cursor);
    const result = await this.pool.query<DoubletGroupRow>(
      `
        WITH RECURSIVE
          root_entries AS (
            SELECT
              lexical_entries.id,
              lexical_entries.node_id
            FROM lexical_entries
            WHERE lexical_entries.lang_code = $1
          ),
          ancestor_walk AS (
            SELECT
              root_entries.id AS root_entry_id,
              root_entries.node_id AS node_id,
              0 AS depth,
              ARRAY[root_entries.node_id] AS path,
              ARRAY[root_entries.id]::TEXT[] AS allowed_entry_ids
            FROM root_entries

            UNION ALL

            SELECT
              ancestor_walk.root_entry_id,
              next_edge.to_node_id AS node_id,
              ancestor_walk.depth + 1 AS depth,
              ancestor_walk.path || next_edge.to_node_id AS path,
              current_allowed.allowed_entry_ids AS allowed_entry_ids
            FROM ancestor_walk
            CROSS JOIN LATERAL (
              SELECT ancestor_walk.allowed_entry_ids || COALESCE((
                SELECT ARRAY_AGG(candidate.id)
                FROM lexical_entries candidate
                WHERE candidate.node_id = ancestor_walk.node_id
                  AND NOT candidate.id = ANY(ancestor_walk.allowed_entry_ids)
                  AND (
                    (
                      SELECT COUNT(*) FROM lexical_entries
                      WHERE lexical_entries.node_id = ancestor_walk.node_id
                    ) = 1
                    OR EXISTS (
                      SELECT 1
                      FROM graph_edges adopt_edge
                      JOIN graph_edges seed_edge
                        ON seed_edge.from_node_id = adopt_edge.from_node_id
                        AND seed_edge.to_node_id = adopt_edge.to_node_id
                        AND seed_edge.edge_type = ANY($3::TEXT[])
                        AND seed_edge.originating_entry_id = ANY(ancestor_walk.allowed_entry_ids)
                      WHERE adopt_edge.originating_entry_id = candidate.id
                        AND adopt_edge.from_node_id = ancestor_walk.node_id
                        AND adopt_edge.edge_type = ANY($3::TEXT[])
                    )
                  )
              ), ARRAY[]::TEXT[]) AS allowed_entry_ids
            ) current_allowed
            JOIN graph_edges next_edge
              ON next_edge.from_node_id = ancestor_walk.node_id
            WHERE ancestor_walk.depth < $2
              AND next_edge.edge_type = ANY($3::TEXT[])
              AND next_edge.originating_entry_id = ANY(current_allowed.allowed_entry_ids)
              AND NOT next_edge.to_node_id = ANY(ancestor_walk.path)
          ),
          reachable_ancestors AS (
            SELECT
              ancestor_walk.root_entry_id,
              ancestor_walk.node_id AS ancestor_node_id,
              MIN(ancestor_walk.depth)::INTEGER AS min_depth
            FROM ancestor_walk
            WHERE ancestor_walk.depth > 0
            GROUP BY ancestor_walk.root_entry_id, ancestor_walk.node_id
          ),
          candidate_groups AS (
            SELECT
              reachable_ancestors.ancestor_node_id,
              COUNT(DISTINCT reachable_ancestors.root_entry_id)::INTEGER AS member_count,
              MIN(reachable_ancestors.min_depth)::INTEGER AS min_depth
            FROM reachable_ancestors
            JOIN root_entries
              ON root_entries.id = reachable_ancestors.root_entry_id
            GROUP BY reachable_ancestors.ancestor_node_id
            HAVING COUNT(DISTINCT root_entries.node_id) >= 2
          ),
          paged_groups AS (
            SELECT *
            FROM candidate_groups
            WHERE (
              $5::INTEGER IS NULL
              OR candidate_groups.member_count < $5
              OR (
                candidate_groups.member_count = $5
                AND candidate_groups.ancestor_node_id > $6::TEXT
              )
            )
            ORDER BY candidate_groups.member_count DESC, candidate_groups.ancestor_node_id ASC
            LIMIT $4
          )
        SELECT
          graph_nodes.id,
          graph_nodes.lang_code,
          languages.canonical_name AS lang_name,
          graph_nodes.word,
          graph_nodes.normalized_word,
          lexical_summary.primary_ipa,
          lexical_summary.primary_ipa_label,
          lexical_summary.primary_gloss,
          lexical_summary.primary_pos,
          lexical_summary.entry_count,
          paged_groups.member_count,
          paged_groups.min_depth,
          member_entries.entry_summaries
        FROM paged_groups
        JOIN graph_nodes
          ON graph_nodes.id = paged_groups.ancestor_node_id
        LEFT JOIN languages
          ON languages.code = graph_nodes.lang_code
        ${LEXICAL_SUMMARY_LATERAL_SQL}
        CROSS JOIN LATERAL (
          SELECT COALESCE(
            JSONB_AGG(
              JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
                'id', ranked_entries.id,
                'nodeId', ranked_entries.node_id,
                'langCode', ranked_entries.lang_code,
                'word', ranked_entries.word,
                'normalizedWord', ranked_entries.normalized_word,
                'pos', ranked_entries.pos,
                'etymologyNumber', ranked_entries.etymology_number,
                'primaryIpa', ranked_entries.primary_ipa,
                'primaryIpaLabel', ranked_entries.primary_ipa_label,
                'primaryGloss', ranked_entries.primary_gloss
              ))
              ORDER BY ranked_entries.normalized_word, ranked_entries.etymology_number NULLS FIRST, ranked_entries.pos NULLS FIRST, ranked_entries.id
            ),
            '[]'::JSONB
          ) AS entry_summaries
          FROM (
            SELECT
              lexical_entries.id,
              lexical_entries.node_id,
              lexical_entries.lang_code,
              lexical_entries.word,
              lexical_entries.normalized_word,
              lexical_entries.pos,
              lexical_entries.etymology_number,
              lexical_entries.primary_ipa,
              lexical_entries.primary_ipa_label,
              lexical_entries.primary_gloss
            FROM reachable_ancestors
            JOIN lexical_entries
              ON lexical_entries.id = reachable_ancestors.root_entry_id
            WHERE reachable_ancestors.ancestor_node_id = paged_groups.ancestor_node_id
            ORDER BY
              lexical_entries.normalized_word ASC,
              lexical_entries.etymology_number ASC NULLS FIRST,
              lexical_entries.pos ASC NULLS FIRST,
              lexical_entries.id ASC
            LIMIT $7
          ) ranked_entries
        ) member_entries
        ORDER BY paged_groups.member_count DESC, paged_groups.ancestor_node_id ASC
      `,
      [
        query.langCode,
        query.maxDepth,
        [...DOUBLET_TRAVERSAL_EDGE_TYPES],
        resultLimit,
        cursor?.entryCount ?? null,
        cursor?.ancestorId ?? null,
        query.entryLimit
      ]
    );
    const visibleRows = result.rows.slice(0, query.limit);
    const nextCursor =
      result.rows.length > query.limit ? formatDoubletGroupsCursor(visibleRows[visibleRows.length - 1]) : undefined;

    return {
      groups: visibleRows.map(mapDoubletGroupRow),
      nextCursor
    };
  }

  /**
   * Finds same-language doublets by walking the seed entry's ancestors with the entry-aware rule, then
   * collecting other same-language entries whose own chain edges meet the seed at a shared ancestor. A
   * doublet candidate only appears when its lexical entry's chain explicitly converges on one of the
   * seed's ancestors, so unrelated homograph trees never masquerade as shared ancestry.
   */
  public async findDoublets(query: DoubletsQuery): Promise<DoubletsResult> {
    const params = [
      query.langCode,
      normalizeCanonicalGraphWord(query.langCode, query.word),
      query.maxDepth,
      [...DOUBLET_TRAVERSAL_EDGE_TYPES],
      query.pos ?? null,
      query.etymologyNumber ?? null,
      query.limit
    ];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            ${DOUBLET_SHARED_ANCESTORS_CTE_SQL},
            ${DOUBLET_CANDIDATE_ENTRIES_CTE_SQL},
            ${DOUBLET_CANDIDATE_WALK_CTE_SQL},
            selected_candidates AS (
              SELECT
                candidate_entries.candidate_node_id,
                candidate_entries.candidate_entry_id,
                candidate_entries.seed_ancestor_id,
                candidate_entries.ancestor_depth,
                candidate_entries.bridge_edge_id
              FROM candidate_entries
              ORDER BY
                candidate_entries.ancestor_depth ASC,
                candidate_entries.candidate_node_id ASC
              LIMIT $7
            ),
            candidate_walk_for_selected AS (
              SELECT
                candidate_walk.*,
                selected_candidates.ancestor_depth
              FROM candidate_walk
              JOIN selected_candidates
                ON selected_candidates.candidate_entry_id = candidate_walk.candidate_entry_id
                AND selected_candidates.bridge_edge_id = candidate_walk.entry_edge_id
            ),
            doublet_node_depths AS (
              SELECT
                ancestor_path_nodes.node_id,
                (ancestor_path_nodes.path_index - 1)::INTEGER AS depth
              FROM ancestor_walk
              JOIN selected_candidates
                ON selected_candidates.seed_ancestor_id = ancestor_walk.node_id
              CROSS JOIN LATERAL UNNEST(ancestor_walk.path) WITH ORDINALITY AS ancestor_path_nodes(node_id, path_index)

              UNION ALL

              SELECT
                candidate_path_nodes.node_id,
                (candidate_walk_for_selected.ancestor_depth + candidate_walk_for_selected.depth - candidate_path_nodes.path_index + 1)::INTEGER AS depth
              FROM candidate_walk_for_selected
              CROSS JOIN LATERAL UNNEST(candidate_walk_for_selected.path) WITH ORDINALITY AS candidate_path_nodes(node_id, path_index)
            ),
            node_depths AS (
              SELECT
                node_id,
                MIN(depth) AS depth
              FROM doublet_node_depths
              GROUP BY node_id
            )
          SELECT
            graph_nodes.id,
            graph_nodes.lang_code,
            languages.canonical_name AS lang_name,
            graph_nodes.word,
            graph_nodes.normalized_word,
            lexical_summary.primary_ipa,
            lexical_summary.primary_ipa_label,
            lexical_summary.primary_gloss,
            lexical_summary.primary_pos,
            lexical_summary.entry_count,
            node_depths.depth
          FROM node_depths
          JOIN graph_nodes
            ON graph_nodes.id = node_depths.node_id
          LEFT JOIN languages
            ON languages.code = graph_nodes.lang_code
          ${LEXICAL_SUMMARY_LATERAL_SQL}
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        params
      ),
      this.pool.query<EdgeRow>(
        `
          WITH RECURSIVE
            ${ANCHOR_ENTRY_CTE_SQL},
            ${ANCESTOR_WALK_CTE_SQL},
            ${DOUBLET_SHARED_ANCESTORS_CTE_SQL},
            ${DOUBLET_CANDIDATE_ENTRIES_CTE_SQL},
            ${DOUBLET_CANDIDATE_WALK_CTE_SQL},
            selected_candidates AS (
              SELECT
                candidate_entries.candidate_node_id,
                candidate_entries.candidate_entry_id,
                candidate_entries.seed_ancestor_id,
                candidate_entries.ancestor_depth,
                candidate_entries.bridge_edge_id
              FROM candidate_entries
              ORDER BY
                candidate_entries.ancestor_depth ASC,
                candidate_entries.candidate_node_id ASC
              LIMIT $7
            ),
            candidate_walk_for_selected AS (
              SELECT candidate_walk.*
              FROM candidate_walk
              JOIN selected_candidates
                ON selected_candidates.candidate_entry_id = candidate_walk.candidate_entry_id
                AND selected_candidates.bridge_edge_id = candidate_walk.entry_edge_id
            ),
            selected_edge_ids AS (
              SELECT DISTINCT ancestor_path_edge_ids.edge_id
              FROM ancestor_walk
              JOIN selected_candidates
                ON selected_candidates.seed_ancestor_id = ancestor_walk.node_id
              CROSS JOIN LATERAL UNNEST(ancestor_walk.edge_path) AS ancestor_path_edge_ids(edge_id)

              UNION

              SELECT DISTINCT candidate_path_edge_ids.edge_id
              FROM candidate_walk_for_selected
              CROSS JOIN LATERAL UNNEST(candidate_walk_for_selected.edge_path) AS candidate_path_edge_ids(edge_id)
            )
          SELECT
            ${EDGE_COLUMN_LIST}
          FROM selected_edge_ids
          JOIN graph_edges ON graph_edges.id = selected_edge_ids.edge_id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        params
      )
    ]);

    if (nodeResult.rows.length === 0) {
      return { graph: null };
    }

    const rootNode = nodeResult.rows.find((row) => row.depth === 0);

    if (!rootNode) {
      throw new Error("Doublet query returned no root node");
    }

    return {
      graph: {
        rootNodeId: rootNode.id,
        nodes: nodeResult.rows.map(mapNodeRow),
        edges: edgeResult.rows.map(mapEdgeRow),
        maxDepth: query.maxDepth
      }
    };
  }
}

/** Picks the seed entry's reachable ancestors (excluding the seed node itself) used to match doublets. */
const DOUBLET_SHARED_ANCESTORS_CTE_SQL = `
  shared_ancestors AS (
    SELECT
      ancestor_walk.node_id,
      MIN(ancestor_walk.depth) AS ancestor_depth
    FROM ancestor_walk
    WHERE ancestor_walk.depth > 0
    GROUP BY ancestor_walk.node_id
  )
`;

/**
 * Identifies same-language entries that meet the seed's chain at a shared ancestor by owning an ancestor
 * edge whose target is one of the seed's reachable ancestors. The extra OR-clause rejects bridges through
 * a homograph node when the candidate's chain past that node disagrees with the seed's chain, which is
 * how en:is verb-be is kept out of en:ice's doublet list even though they share an enm:is graph node.
 */
const DOUBLET_CANDIDATE_ENTRIES_CTE_SQL = `
  candidate_entries AS (
    SELECT
      candidate_entry.id AS candidate_entry_id,
      candidate_entry.node_id AS candidate_node_id,
      shared_ancestors.node_id AS seed_ancestor_id,
      shared_ancestors.ancestor_depth,
      bridge_edge.id AS bridge_edge_id
    FROM shared_ancestors
    JOIN graph_edges bridge_edge
      ON bridge_edge.to_node_id = shared_ancestors.node_id
      AND bridge_edge.edge_type = ANY($4::TEXT[])
    JOIN lexical_entries candidate_entry
      ON candidate_entry.id = bridge_edge.originating_entry_id
    CROSS JOIN anchor_entry
    WHERE candidate_entry.lang_code = $1
      AND candidate_entry.node_id <> anchor_entry.node_id
      AND (
        (
          SELECT COUNT(DISTINCT divergence_edge.to_node_id)
          FROM graph_edges divergence_edge
          WHERE divergence_edge.from_node_id = shared_ancestors.node_id
            AND divergence_edge.edge_type = ANY($4::TEXT[])
        ) <= 1
        OR EXISTS (
          SELECT 1
          FROM graph_edges candidate_outgoing
          WHERE candidate_outgoing.from_node_id = shared_ancestors.node_id
            AND candidate_outgoing.originating_entry_id = candidate_entry.id
            AND candidate_outgoing.edge_type = ANY($4::TEXT[])
            AND candidate_outgoing.to_node_id IN (
              SELECT seed_outgoing.to_node_id
              FROM ancestor_walk
              JOIN graph_edges seed_outgoing
                ON seed_outgoing.id = ancestor_walk.edge_id
              WHERE ancestor_walk.edge_id IS NOT NULL
                AND seed_outgoing.from_node_id = shared_ancestors.node_id
            )
        )
      )
  )
`;

/**
 * Walks each doublet candidate's own ancestor chain (filtered to that entry's owned edges) until it
 * stops, so the response graph carries the candidate's attested path back to the convergence point.
 */
const DOUBLET_CANDIDATE_WALK_CTE_SQL = `
  candidate_walk AS (
    SELECT
      candidate_entries.candidate_entry_id,
      candidate_entries.candidate_node_id AS node_id,
      0 AS depth,
      ARRAY[candidate_entries.candidate_node_id] AS path,
      ARRAY[]::TEXT[] AS edge_path,
      NULL::TEXT AS entry_edge_id
    FROM candidate_entries

    UNION ALL

    SELECT
      candidate_walk.candidate_entry_id,
      step_edge.to_node_id AS node_id,
      candidate_walk.depth + 1 AS depth,
      candidate_walk.path || step_edge.to_node_id AS path,
      candidate_walk.edge_path || step_edge.id AS edge_path,
      step_edge.id AS entry_edge_id
    FROM candidate_walk
    JOIN graph_edges step_edge
      ON step_edge.from_node_id = candidate_walk.node_id
      AND step_edge.originating_entry_id = candidate_walk.candidate_entry_id
      AND step_edge.edge_type = ANY($4::TEXT[])
    WHERE candidate_walk.depth < $3
      AND NOT step_edge.to_node_id = ANY(candidate_walk.path)
  )
`;

/** Builds parameter array shared by node and edge queries that recursively walk ancestors. */
function buildAnchorParams(
  query: { langCode: string; word: string; pos?: string; etymologyNumber?: number },
  maxDepth: number,
  edgeTypes: readonly EdgeType[]
): unknown[] {
  return [
    query.langCode,
    normalizeCanonicalGraphWord(query.langCode, query.word),
    maxDepth,
    [...edgeTypes],
    query.pos ?? null,
    query.etymologyNumber ?? null
  ];
}

/** Normalizes query terms through the same canonical graph identity rule used by imports. */
const normalizeCanonicalGraphWord = (langCode: string, word: string): string =>
  normalizeWord(canonicalGraphWord(langCode, word));

/** Maps language rows into the shared DTO used by language-scoped search controls. */
function mapLanguageRow(row: LanguageRow): Language {
  return {
    code: row.code,
    canonicalName: row.canonical_name
  };
}

/** Maps database naming into the graph DTO used by API handlers and clients. */
function mapNodeRow(row: NodeRow): GraphTraversalNode {
  return {
    ...mapBaseNodeRow(row),
    depth: row.depth
  };
}

/** Maps term rows into the shared graph node contract used by search results. */
function mapBaseNodeRow(row: BaseNodeRow): GraphNode {
  return {
    id: row.id,
    langCode: row.lang_code,
    langName: row.lang_name ?? undefined,
    word: row.word,
    normalizedWord: row.normalized_word,
    lexicalSummary: mapLexicalSummary(row)
  };
}

/** Finds the shared source node from successful comparison paths without issuing a separate lookup. */
function findComparisonSetRoot(
  query: ComparisonSetQuery,
  groups: ComparisonSetResolvedGroup[]
): GraphNode | null {
  const normalizedRootWord = normalizeCanonicalGraphWord(query.root.langCode, query.root.word);

  for (const group of groups) {
    for (const item of group.items) {
      const rootNode = item.graph?.nodes.find(
        (node) => node.langCode === query.root.langCode && node.normalizedWord === normalizedRootWord
      );

      if (rootNode) {
        return rootNode;
      }
    }
  }

  return null;
}

/** Combines every successful cognate path into one branch graph rooted at the shared source form. */
function mergeComparisonSetGraphs(
  query: ComparisonSetQuery,
  groups: ComparisonSetResolvedGroup[],
  root: GraphNode | null
): EtymologyGraph | null {
  if (!root) {
    return null;
  }

  const nodesById = new Map<string, GraphTraversalNode>();
  const edgesById = new Map<string, GraphEdge>();

  for (const group of groups) {
    for (const item of group.items) {
      if (!item.graph) {
        continue;
      }

      for (const node of item.graph.nodes) {
        nodesById.set(node.id, node);
      }
      for (const edge of item.graph.edges) {
        edgesById.set(edge.id, edge);
      }
    }
  }

  if (nodesById.size === 0) {
    return null;
  }

  const nodes = comparisonSetNodesBySourceDepth(root.id, nodesById, [...edgesById.values()]);

  return {
    rootNodeId: root.id,
    nodes,
    edges: [...edgesById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    maxDepth: query.maxDepth
  };
}

/** Recomputes display depth from the shared ancestor outward so branch layouts compare descendants. */
function comparisonSetNodesBySourceDepth(
  rootNodeId: string,
  nodesById: Map<string, GraphTraversalNode>,
  edges: GraphEdge[]
): GraphTraversalNode[] {
  const childrenByParentId = new Map<string, string[]>();

  for (const edge of edges) {
    childrenByParentId.set(edge.toNodeId, [...(childrenByParentId.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }

  const depthsByNodeId = new Map<string, number>([[rootNodeId, 0]]);
  const pendingNodeIds = [rootNodeId];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.shift();

    if (!nodeId) {
      continue;
    }

    const nextDepth = (depthsByNodeId.get(nodeId) ?? 0) + 1;

    for (const childNodeId of childrenByParentId.get(nodeId) ?? []) {
      if ((depthsByNodeId.get(childNodeId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
        continue;
      }

      depthsByNodeId.set(childNodeId, nextDepth);
      pendingNodeIds.push(childNodeId);
    }
  }

  return [...nodesById.values()]
    .map((node) => ({
      ...node,
      depth: depthsByNodeId.get(node.id) ?? node.depth
    }))
    .sort((left, right) => left.depth - right.depth || left.langCode.localeCompare(right.langCode) || left.word.localeCompare(right.word));
}

/** Maps aggregated lexical metadata into the compact node summary used by graph and search UI. */
function mapLexicalSummary(row: BaseNodeRow): LexicalSummary | undefined {
  return mapLexicalSummaryFields(row);
}

/** Maps edge rows while checking that stored edge values still match shared graph types. */
function mapEdgeRow(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    type: parseEdgeType(row.edge_type),
    source: parseEdgeSource(row.source),
    etymologyNumber: row.etymology_number ?? undefined,
    templateName: row.template_name ?? undefined,
    uncertain: row.uncertain,
    originatingEntryId: row.originating_entry_id
  };
}

/** Maps lexical entry rows into the compact summary the chooser UI renders for each homograph. */
function mapTermEntryRow(row: TermEntryRow): TermEntrySummary {
  return {
    id: row.id,
    nodeId: row.node_id,
    langCode: row.lang_code,
    word: row.word,
    normalizedWord: row.normalized_word,
    pos: row.pos ?? undefined,
    etymologyNumber: row.etymology_number ?? undefined,
    primaryIpa: row.primary_ipa ?? undefined,
    primaryIpaLabel: row.primary_ipa_label ?? undefined,
    primaryGloss: row.primary_gloss ?? undefined
  };
}

/** Maps ancestor-language search rows into the list DTO with enough path evidence for clients to explain a match. */
function mapTermsWithAncestorLanguageRow(
  row: TermsWithAncestorLanguageRow
): TermsWithAncestorLanguageMatch {
  return {
    entry: {
      id: row.entry_id,
      nodeId: row.entry_node_id,
      langCode: row.entry_lang_code,
      word: row.entry_word,
      normalizedWord: row.entry_normalized_word,
      pos: row.entry_pos ?? undefined,
      etymologyNumber: row.entry_etymology_number ?? undefined,
      primaryIpa: row.entry_primary_ipa ?? undefined,
      primaryIpaLabel: row.entry_primary_ipa_label ?? undefined,
      primaryGloss: row.entry_primary_gloss ?? undefined
    },
    node: {
      id: row.entry_node_id,
      langCode: row.entry_lang_code,
      langName: row.node_lang_name ?? undefined,
      word: row.entry_word,
      normalizedWord: row.entry_normalized_word,
      lexicalSummary: mapLexicalSummaryFields({
        primary_ipa: row.entry_primary_ipa,
        primary_ipa_label: row.entry_primary_ipa_label,
        primary_gloss: row.entry_primary_gloss,
        primary_pos: row.entry_pos,
        entry_count: row.node_entry_count
      })
    },
    matchedAncestor: {
      id: row.ancestor_id,
      langCode: row.ancestor_lang_code,
      langName: row.ancestor_lang_name ?? undefined,
      word: row.ancestor_word,
      normalizedWord: row.ancestor_normalized_word,
      lexicalSummary: mapLexicalSummaryFields({
        primary_ipa: row.ancestor_primary_ipa,
        primary_ipa_label: row.ancestor_primary_ipa_label,
        primary_gloss: row.ancestor_primary_gloss,
        primary_pos: row.ancestor_primary_pos,
        entry_count: row.ancestor_entry_count
      })
    },
    depth: row.depth,
    pathEdgeIds: row.path_edge_ids
  };
}

/** Maps grouped doublet rows into a bounded list result suitable for language-wide browsing. */
function mapDoubletGroupRow(row: DoubletGroupRow): DoubletGroup {
  return {
    sharedAncestor: mapBaseNodeRow(row),
    entries: doubletGroupEntriesSchema.parse(row.entry_summaries),
    entryCount: row.member_count,
    minDepth: row.min_depth
  };
}

/** Parses the opaque group cursor used for keyset pagination over ranked doublet groups. */
function parseDoubletGroupsCursor(cursor: string | undefined): DoubletGroupsCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  const separatorIndex = cursor.indexOf(":");
  const entryCount = Number.parseInt(cursor.slice(0, separatorIndex), 10);
  const ancestorId = cursor.slice(separatorIndex + 1);

  if (!Number.isInteger(entryCount) || entryCount < 2 || ancestorId.length === 0) {
    throw new Error("Invalid doublet groups cursor");
  }

  return {
    entryCount,
    ancestorId
  };
}

/** Encodes the last visible group so the next request can continue the same ranking order. */
function formatDoubletGroupsCursor(row: DoubletGroupRow | undefined): string | undefined {
  if (!row) {
    return undefined;
  }

  return `${row.member_count}:${row.id}`;
}

type LexicalSummaryFields = {
  primary_ipa: string | null;
  primary_ipa_label: string | null;
  primary_gloss: string | null;
  primary_pos: string | null;
  entry_count: number | null;
};

/** Converts nullable lexical aggregate columns into omitted fields for public node summaries. */
function mapLexicalSummaryFields(row: LexicalSummaryFields): LexicalSummary | undefined {
  const entryCount = row.entry_count ?? 0;
  const summary = {
    ipa: row.primary_ipa ?? undefined,
    ipaLabel: row.primary_ipa_label ?? undefined,
    definition: row.primary_gloss ?? undefined,
    pos: row.primary_pos ?? undefined,
    entryCount: entryCount > 0 ? entryCount : undefined
  };

  return Object.values(summary).some((value) => value !== undefined) ? summary : undefined;
}

/** Protects clients from unknown edge types that may have entered the database. */
function parseEdgeType(edgeType: string): EdgeType {
  const knownEdgeTypes: readonly string[] = EDGE_TYPES;

  if (!knownEdgeTypes.includes(edgeType)) {
    throw new Error(`Unknown graph edge type: ${edgeType}`);
  }

  return edgeType as EdgeType;
}

/** Keeps the public graph edge source constrained to currently supported import sources. */
function parseEdgeSource(source: string): "wiktextract" {
  if (source !== "wiktextract") {
    throw new Error(`Unknown graph edge source: ${source}`);
  }

  return source;
}

/** Escapes user search text so SQL LIKE treats it as text, not wildcard syntax. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
