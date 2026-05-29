import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  ancestorPathQuerySchema,
  ancestorPathResultSchema,
  type AncestorPathQuery,
  type AncestorPathResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type AncestorPathQueryKey = readonly ["ancestorPath", AncestorPathQuery | null];

export type AncestorPathQueryOptions = Omit<
  UseQueryOptions<AncestorPathResult, Error, AncestorPathResult, AncestorPathResult, AncestorPathQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds a cache key for a path-specific ancestry graph between two terms. */
export function ancestorPathQueryKey(query: AncestorPathQuery | null): AncestorPathQueryKey {
  return ["ancestorPath", query] as const;
}

/** Validates a path request before it reaches the API boundary. */
function resolveAncestorPathQuery(input: MaybeRefOrGetter<AncestorPathQuery | null>): AncestorPathQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return ancestorPathQuerySchema.parse(query);
}

/** Fetches and validates a single source-to-ancestor path graph from the API. */
export async function fetchAncestorPath(
  input: AncestorPathQuery,
  signal?: AbortSignal
): Promise<AncestorPathResult> {
  const query = ancestorPathQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    ancestorLangCode: query.ancestorLangCode,
    ancestorWord: query.ancestorWord,
    maxDepth: String(query.maxDepth)
  });

  if (query.pos !== undefined) {
    params.set("pos", query.pos);
  }
  if (query.etymologyNumber !== undefined) {
    params.set("etymologyNumber", String(query.etymologyNumber));
  }

  const response = await fetch(buildApiUrl(`/api/ancestor-path?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Ancestor path failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = ancestorPathResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Ancestor path response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes TanStack options for path-specific graph loading. */
export function ancestorPathQuery(
  input: MaybeRefOrGetter<AncestorPathQuery | null>
): UseQueryOptions<AncestorPathResult, Error, AncestorPathResult, AncestorPathResult, AncestorPathQueryKey> {
  return {
    queryKey: computed(() => ancestorPathQueryKey(resolveAncestorPathQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveAncestorPathQuery(input);

      if (query === null) {
        throw new Error("Ancestor path queries require a selected match");
      }

      return fetchAncestorPath(query, signal);
    },
    enabled: computed(() => resolveAncestorPathQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack loading for a graph containing only the path between two terms. */
export function useAncestorPathQuery(
  input: MaybeRefOrGetter<AncestorPathQuery | null>,
  options?: AncestorPathQueryOptions
): UseQueryReturnType<AncestorPathResult, Error> {
  return useQuery({
    ...ancestorPathQuery(input),
    ...(options ?? {})
  });
}
