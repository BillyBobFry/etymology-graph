import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  ancestorsQuerySchema,
  ancestorsResultSchema,
  type AncestorsQuery,
  type AncestorsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type AncestorGraphQueryKey = readonly ["ancestorGraph", AncestorsQuery | null];

export type AncestorGraphQueryOptions = Omit<
  UseQueryOptions<AncestorsResult, Error, AncestorsResult, AncestorsResult, AncestorGraphQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so identical ancestor graph requests reuse results. */
export function ancestorGraphQueryKey(query: AncestorsQuery | null): AncestorGraphQueryKey {
  return ["ancestorGraph", query] as const;
}

/** Validates a selected node traversal request before fetching graph data. */
function resolveAncestorGraphQuery(
  input: MaybeRefOrGetter<AncestorsQuery | null>
): AncestorsQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return ancestorsQuerySchema.parse(query);
}

/** Fetches and validates ancestor graph data from the API boundary. */
export async function fetchAncestorGraph(
  input: AncestorsQuery,
  signal?: AbortSignal
): Promise<AncestorsResult> {
  const query = ancestorsQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    maxDepth: String(query.maxDepth)
  });
  if (query.pos !== undefined) {
    params.set("pos", query.pos);
  }
  if (query.etymologyNumber !== undefined) {
    params.set("etymologyNumber", String(query.etymologyNumber));
  }
  const response = await fetch(buildApiUrl(`/api/ancestors?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Graph failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = ancestorsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Graph response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for reuse in prefetching or tests. */
export function ancestorGraphQuery(
  input: MaybeRefOrGetter<AncestorsQuery | null>
): UseQueryOptions<AncestorsResult, Error, AncestorsResult, AncestorsResult, AncestorGraphQueryKey> {
  return {
    queryKey: computed(() => ancestorGraphQueryKey(resolveAncestorGraphQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveAncestorGraphQuery(input);

      if (query === null) {
        throw new Error("Ancestor graph queries require a selected term");
      }

      return fetchAncestorGraph(query, signal);
    },
    enabled: computed(() => resolveAncestorGraphQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack ancestor loading while letting callers override supported query options. */
export function useAncestorGraphQuery(
  input: MaybeRefOrGetter<AncestorsQuery | null>,
  options?: AncestorGraphQueryOptions
): UseQueryReturnType<AncestorsResult, Error> {
  return useQuery({
    ...ancestorGraphQuery(input),
    ...(options ?? {})
  });
}
