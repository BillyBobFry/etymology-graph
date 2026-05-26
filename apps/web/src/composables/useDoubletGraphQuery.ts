import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  doubletsQuerySchema,
  doubletsResultSchema,
  type DoubletsQuery,
  type DoubletsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

export type DoubletGraphQueryKey = readonly ["doubletGraph", DoubletsQuery | null];

export type DoubletGraphQueryOptions = Omit<
  UseQueryOptions<DoubletsResult, Error, DoubletsResult, DoubletsResult, DoubletGraphQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so identical inferred doublet requests reuse graph results. */
export function doubletGraphQueryKey(query: DoubletsQuery | null): DoubletGraphQueryKey {
  return ["doubletGraph", query] as const;
}

/** Validates the selected term before asking the API for inferred doublets. */
function resolveDoubletGraphQuery(
  input: MaybeRefOrGetter<DoubletsQuery | null>
): DoubletsQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return doubletsQuerySchema.parse(query);
}

/** Fetches and validates inferred doublet graph data from the API boundary. */
export async function fetchDoubletGraph(
  input: DoubletsQuery,
  signal?: AbortSignal
): Promise<DoubletsResult> {
  const query = doubletsQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    maxDepth: String(query.maxDepth),
    limit: String(query.limit)
  });
  const response = await fetch(`/api/doublets?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Doublet graph failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = doubletsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Doublet graph response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for route loaders or tests. */
export function doubletGraphQuery(
  input: MaybeRefOrGetter<DoubletsQuery | null>
): UseQueryOptions<DoubletsResult, Error, DoubletsResult, DoubletsResult, DoubletGraphQueryKey> {
  return {
    queryKey: computed(() => doubletGraphQueryKey(resolveDoubletGraphQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveDoubletGraphQuery(input);

      if (query === null) {
        throw new Error("Doublet graph queries require a selected term");
      }

      return fetchDoubletGraph(query, signal);
    },
    enabled: computed(() => resolveDoubletGraphQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack doublet loading while letting callers override supported query options. */
export function useDoubletGraphQuery(
  input: MaybeRefOrGetter<DoubletsQuery | null>,
  options?: DoubletGraphQueryOptions
): UseQueryReturnType<DoubletsResult, Error> {
  return useQuery({
    ...doubletGraphQuery(input),
    ...(options ?? {})
  });
}
