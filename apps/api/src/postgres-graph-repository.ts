import type { Pool } from "pg";

import {
  EDGE_TYPES,
  normalizeWord,
  type AncestorsQuery,
  type AncestorsResult,
  type ChildTermsQuery,
  type ChildTermsResult,
  type DoubletsQuery,
  type DoubletsResult,
  type EdgeType,
  type GraphEdge,
  type GraphNode,
  type GraphTraversalNode,
  type Language,
  type LexicalSummary,
  type LanguagesResult,
  type SearchTermsQuery,
  type SearchTermsResult
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
};

type LanguageRow = {
  code: string;
  canonical_name: string;
};

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
    const normalizedQuery = normalizeWord(query.query);

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

  /** Finds source terms for a term using Postgres recursion while hiding SQL from handlers. */
  public async findAncestors(query: AncestorsQuery): Promise<AncestorsResult> {
    const normalizedWord = normalizeWord(query.word);
    const ancestorEdgeTypes = [...ANCESTOR_TRAVERSAL_EDGE_TYPES];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH RECURSIVE ancestor_walk AS (
            SELECT
              graph_nodes.id AS node_id,
              0 AS depth,
              NULL::TEXT AS edge_id,
              ARRAY[graph_nodes.id] AS path
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2

            UNION ALL

            SELECT
              graph_edges.to_node_id AS node_id,
              ancestor_walk.depth + 1 AS depth,
              graph_edges.id AS edge_id,
              ancestor_walk.path || graph_edges.to_node_id AS path
            FROM ancestor_walk
            JOIN graph_edges
              ON graph_edges.from_node_id = ancestor_walk.node_id
            WHERE ancestor_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.to_node_id = ANY(ancestor_walk.path)
          ),
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
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        [query.langCode, normalizedWord, query.maxDepth, ancestorEdgeTypes]
      ),
      this.pool.query<EdgeRow>(
        `
          WITH RECURSIVE ancestor_walk AS (
            SELECT
              graph_nodes.id AS node_id,
              0 AS depth,
              NULL::TEXT AS edge_id,
              ARRAY[graph_nodes.id] AS path
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2

            UNION ALL

            SELECT
              graph_edges.to_node_id AS node_id,
              ancestor_walk.depth + 1 AS depth,
              graph_edges.id AS edge_id,
              ancestor_walk.path || graph_edges.to_node_id AS path
            FROM ancestor_walk
            JOIN graph_edges
              ON graph_edges.from_node_id = ancestor_walk.node_id
            WHERE ancestor_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.to_node_id = ANY(ancestor_walk.path)
          ),
          traversed_edges AS (
            SELECT DISTINCT edge_id
            FROM ancestor_walk
            WHERE edge_id IS NOT NULL
          )
          SELECT
            graph_edges.id,
            graph_edges.from_node_id,
            graph_edges.to_node_id,
            graph_edges.edge_type,
            graph_edges.source,
            graph_edges.etymology_number,
            graph_edges.template_name,
            graph_edges.uncertain
          FROM traversed_edges
          JOIN graph_edges
            ON graph_edges.id = traversed_edges.edge_id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        [query.langCode, normalizedWord, query.maxDepth, ancestorEdgeTypes]
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

  /** Finds direct child terms by traversing source-directed edges one step in reverse. */
  public async findChildTerms(query: ChildTermsQuery): Promise<ChildTermsResult> {
    const normalizedWord = normalizeWord(query.word);
    const childTermEdgeTypes = [...CHILD_TERM_EDGE_TYPES];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH root AS (
            SELECT
              graph_nodes.id
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2
          ),
          child_nodes AS (
            SELECT
              graph_edges.from_node_id AS node_id,
              1 AS depth
            FROM graph_edges
            JOIN root
              ON root.id = graph_edges.to_node_id
            WHERE graph_edges.edge_type = ANY($3::TEXT[])
            GROUP BY graph_edges.from_node_id
            ORDER BY graph_edges.from_node_id
            LIMIT $4
          ),
          node_depths AS (
            SELECT
              root.id AS node_id,
              0 AS depth
            FROM root

            UNION ALL

            SELECT
              child_nodes.node_id,
              child_nodes.depth
            FROM child_nodes
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
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        [query.langCode, normalizedWord, childTermEdgeTypes, query.limit]
      ),
      this.pool.query<EdgeRow>(
        `
          WITH root AS (
            SELECT
              graph_nodes.id
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2
          ),
          child_nodes AS (
            SELECT
              graph_edges.from_node_id AS node_id
            FROM graph_edges
            JOIN root
              ON root.id = graph_edges.to_node_id
            WHERE graph_edges.edge_type = ANY($3::TEXT[])
            GROUP BY graph_edges.from_node_id
            ORDER BY graph_edges.from_node_id
            LIMIT $4
          )
          SELECT
            graph_edges.id,
            graph_edges.from_node_id,
            graph_edges.to_node_id,
            graph_edges.edge_type,
            graph_edges.source,
            graph_edges.etymology_number,
            graph_edges.template_name,
            graph_edges.uncertain
          FROM graph_edges
          JOIN root
            ON root.id = graph_edges.to_node_id
          JOIN child_nodes
            ON child_nodes.node_id = graph_edges.from_node_id
          WHERE graph_edges.edge_type = ANY($3::TEXT[])
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        [query.langCode, normalizedWord, childTermEdgeTypes, query.limit]
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

  /** Finds same-language terms that share reachable ancestors with the selected term. */
  public async findDoublets(query: DoubletsQuery): Promise<DoubletsResult> {
    const normalizedWord = normalizeWord(query.word);
    const doubletEdgeTypes = [...DOUBLET_TRAVERSAL_EDGE_TYPES];

    const [nodeResult, edgeResult] = await Promise.all([
      this.pool.query<NodeRow>(
        `
          WITH RECURSIVE root AS (
            SELECT
              graph_nodes.id
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2
          ),
          ancestor_walk AS (
            SELECT
              root.id AS node_id,
              0 AS depth,
              ARRAY[root.id] AS path,
              ARRAY[]::TEXT[] AS edge_path
            FROM root

            UNION ALL

            SELECT
              graph_edges.to_node_id AS node_id,
              ancestor_walk.depth + 1 AS depth,
              ancestor_walk.path || graph_edges.to_node_id AS path,
              ancestor_walk.edge_path || graph_edges.id AS edge_path
            FROM ancestor_walk
            JOIN graph_edges
              ON graph_edges.from_node_id = ancestor_walk.node_id
            WHERE ancestor_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.to_node_id = ANY(ancestor_walk.path)
          ),
          shared_ancestors AS (
            SELECT
              node_id,
              MIN(depth) AS ancestor_depth
            FROM ancestor_walk
            WHERE depth > 0
            GROUP BY node_id
          ),
          descendant_walk AS (
            SELECT
              shared_ancestors.node_id AS seed_ancestor_id,
              shared_ancestors.node_id AS node_id,
              0 AS depth,
              ARRAY[shared_ancestors.node_id] AS path,
              ARRAY[]::TEXT[] AS edge_path
            FROM shared_ancestors

            UNION ALL

            SELECT
              descendant_walk.seed_ancestor_id,
              graph_edges.from_node_id AS node_id,
              descendant_walk.depth + 1 AS depth,
              descendant_walk.path || graph_edges.from_node_id AS path,
              descendant_walk.edge_path || graph_edges.id AS edge_path
            FROM descendant_walk
            JOIN graph_edges
              ON graph_edges.to_node_id = descendant_walk.node_id
            WHERE descendant_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.from_node_id = ANY(descendant_walk.path)
          ),
          candidate_paths AS (
            SELECT
              descendant_walk.seed_ancestor_id,
              descendant_walk.node_id,
              descendant_walk.depth,
              descendant_walk.path,
              descendant_walk.edge_path,
              shared_ancestors.ancestor_depth,
              shared_ancestors.ancestor_depth + descendant_walk.depth AS total_depth
            FROM descendant_walk
            JOIN shared_ancestors
              ON shared_ancestors.node_id = descendant_walk.seed_ancestor_id
            JOIN graph_nodes
              ON graph_nodes.id = descendant_walk.node_id
            CROSS JOIN root
            WHERE descendant_walk.depth > 0
              AND graph_nodes.lang_code = $1
              AND graph_nodes.id <> root.id
          ),
          candidate_nodes AS (
            SELECT
              node_id,
              MIN(total_depth) AS score,
              COUNT(DISTINCT seed_ancestor_id) AS shared_ancestor_count
            FROM candidate_paths
            GROUP BY node_id
            ORDER BY score, shared_ancestor_count DESC, node_id
            LIMIT $5
          ),
          selected_candidate_paths AS (
            SELECT
              candidate_paths.*
            FROM candidate_paths
            JOIN candidate_nodes
              ON candidate_nodes.node_id = candidate_paths.node_id
          ),
          selected_ancestor_ids AS (
            SELECT DISTINCT
              seed_ancestor_id
            FROM selected_candidate_paths
          ),
          selected_node_depths AS (
            SELECT
              ancestor_path_nodes.node_id,
              (ancestor_path_nodes.path_index - 1)::INTEGER AS depth
            FROM ancestor_walk
            JOIN selected_ancestor_ids
              ON selected_ancestor_ids.seed_ancestor_id = ancestor_walk.node_id
            CROSS JOIN LATERAL UNNEST(ancestor_walk.path) WITH ORDINALITY AS ancestor_path_nodes(node_id, path_index)

            UNION ALL

            SELECT
              descendant_path_nodes.node_id,
              (selected_candidate_paths.ancestor_depth + descendant_path_nodes.path_index - 1)::INTEGER AS depth
            FROM selected_candidate_paths
            CROSS JOIN LATERAL UNNEST(selected_candidate_paths.path) WITH ORDINALITY AS descendant_path_nodes(node_id, path_index)
          ),
          node_depths AS (
            SELECT
              node_id,
              MIN(depth) AS depth
            FROM selected_node_depths
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
          ORDER BY node_depths.depth, graph_nodes.lang_code, graph_nodes.normalized_word
        `,
        [query.langCode, normalizedWord, query.maxDepth, doubletEdgeTypes, query.limit]
      ),
      this.pool.query<EdgeRow>(
        `
          WITH RECURSIVE root AS (
            SELECT
              graph_nodes.id
            FROM graph_nodes
            WHERE graph_nodes.lang_code = $1
              AND graph_nodes.normalized_word = $2
          ),
          ancestor_walk AS (
            SELECT
              root.id AS node_id,
              0 AS depth,
              ARRAY[root.id] AS path,
              ARRAY[]::TEXT[] AS edge_path
            FROM root

            UNION ALL

            SELECT
              graph_edges.to_node_id AS node_id,
              ancestor_walk.depth + 1 AS depth,
              ancestor_walk.path || graph_edges.to_node_id AS path,
              ancestor_walk.edge_path || graph_edges.id AS edge_path
            FROM ancestor_walk
            JOIN graph_edges
              ON graph_edges.from_node_id = ancestor_walk.node_id
            WHERE ancestor_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.to_node_id = ANY(ancestor_walk.path)
          ),
          shared_ancestors AS (
            SELECT
              node_id,
              MIN(depth) AS ancestor_depth
            FROM ancestor_walk
            WHERE depth > 0
            GROUP BY node_id
          ),
          descendant_walk AS (
            SELECT
              shared_ancestors.node_id AS seed_ancestor_id,
              shared_ancestors.node_id AS node_id,
              0 AS depth,
              ARRAY[shared_ancestors.node_id] AS path,
              ARRAY[]::TEXT[] AS edge_path
            FROM shared_ancestors

            UNION ALL

            SELECT
              descendant_walk.seed_ancestor_id,
              graph_edges.from_node_id AS node_id,
              descendant_walk.depth + 1 AS depth,
              descendant_walk.path || graph_edges.from_node_id AS path,
              descendant_walk.edge_path || graph_edges.id AS edge_path
            FROM descendant_walk
            JOIN graph_edges
              ON graph_edges.to_node_id = descendant_walk.node_id
            WHERE descendant_walk.depth < $3
              AND graph_edges.edge_type = ANY($4::TEXT[])
              AND NOT graph_edges.from_node_id = ANY(descendant_walk.path)
          ),
          candidate_paths AS (
            SELECT
              descendant_walk.seed_ancestor_id,
              descendant_walk.node_id,
              descendant_walk.depth,
              descendant_walk.edge_path,
              shared_ancestors.ancestor_depth,
              shared_ancestors.ancestor_depth + descendant_walk.depth AS total_depth
            FROM descendant_walk
            JOIN shared_ancestors
              ON shared_ancestors.node_id = descendant_walk.seed_ancestor_id
            JOIN graph_nodes
              ON graph_nodes.id = descendant_walk.node_id
            CROSS JOIN root
            WHERE descendant_walk.depth > 0
              AND graph_nodes.lang_code = $1
              AND graph_nodes.id <> root.id
          ),
          candidate_nodes AS (
            SELECT
              node_id,
              MIN(total_depth) AS score,
              COUNT(DISTINCT seed_ancestor_id) AS shared_ancestor_count
            FROM candidate_paths
            GROUP BY node_id
            ORDER BY score, shared_ancestor_count DESC, node_id
            LIMIT $5
          ),
          selected_candidate_paths AS (
            SELECT
              candidate_paths.*
            FROM candidate_paths
            JOIN candidate_nodes
              ON candidate_nodes.node_id = candidate_paths.node_id
          ),
          selected_ancestor_ids AS (
            SELECT DISTINCT
              seed_ancestor_id
            FROM selected_candidate_paths
          ),
          selected_edge_ids AS (
            SELECT DISTINCT
              ancestor_edge_ids.edge_id
            FROM ancestor_walk
            JOIN selected_ancestor_ids
              ON selected_ancestor_ids.seed_ancestor_id = ancestor_walk.node_id
            CROSS JOIN LATERAL UNNEST(ancestor_walk.edge_path) AS ancestor_edge_ids(edge_id)

            UNION

            SELECT DISTINCT
              descendant_edge_ids.edge_id
            FROM selected_candidate_paths
            CROSS JOIN LATERAL UNNEST(selected_candidate_paths.edge_path) AS descendant_edge_ids(edge_id)
          )
          SELECT
            graph_edges.id,
            graph_edges.from_node_id,
            graph_edges.to_node_id,
            graph_edges.edge_type,
            graph_edges.source,
            graph_edges.etymology_number,
            graph_edges.template_name,
            graph_edges.uncertain
          FROM selected_edge_ids
          JOIN graph_edges
            ON graph_edges.id = selected_edge_ids.edge_id
          ORDER BY graph_edges.edge_type, graph_edges.id
        `,
        [query.langCode, normalizedWord, query.maxDepth, doubletEdgeTypes, query.limit]
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

/** Maps aggregated lexical metadata into the compact node summary used by graph and search UI. */
function mapLexicalSummary(row: BaseNodeRow): LexicalSummary | undefined {
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
    uncertain: row.uncertain
  };
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
