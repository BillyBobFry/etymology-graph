import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  descendantsQuerySchema,
  descendantsResultSchema,
  type DescendantsQuery,
  type DescendantsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type DescendantsGraphQueryKey = readonly ["descendantsGraph", DescendantsQuery | null];

export type DescendantsGraphQueryOptions = Omit<
  UseQueryOptions<DescendantsResult, Error, DescendantsResult, DescendantsResult, DescendantsGraphQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so broad descendant graphs refetch only when scope controls change. */
export function descendantsGraphQueryKey(query: DescendantsQuery | null): DescendantsGraphQueryKey {
  return ["descendantsGraph", query] as const;
}

/** Validates the selected PIE root and graph scope before hitting the API. */
function resolveDescendantsGraphQuery(input: MaybeRefOrGetter<DescendantsQuery | null>): DescendantsQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return descendantsQuerySchema.parse(query);
}

/** Fetches and validates bounded descendant graph data from the API boundary. */
export async function fetchDescendantsGraph(input: DescendantsQuery, signal?: AbortSignal): Promise<DescendantsResult> {
  const query = descendantsQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    maxDepth: String(query.maxDepth),
    limit: String(query.limit)
  });

  if (query.pos !== undefined) {
    params.set("pos", query.pos);
  }
  if (query.etymologyNumber !== undefined) {
    params.set("etymologyNumber", String(query.etymologyNumber));
  }
  for (const langCode of query.terminalLangCodes ?? []) {
    params.append("terminalLangCodes", langCode);
  }

  const response = await fetch(buildApiUrl(`/api/descendants?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Descendants graph failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = descendantsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Descendants graph response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the TanStack descendants graph query with caller-controlled caching options. */
export function descendantsGraphQuery(
  input: MaybeRefOrGetter<DescendantsQuery | null>
): UseQueryOptions<DescendantsResult, Error, DescendantsResult, DescendantsResult, DescendantsGraphQueryKey> {
  return {
    queryKey: computed(() => descendantsGraphQueryKey(resolveDescendantsGraphQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveDescendantsGraphQuery(input);

      if (query === null) {
        throw new Error("Descendants graph queries require a selected root");
      }

      return fetchDescendantsGraph(query, signal);
    },
    enabled: computed(() => resolveDescendantsGraphQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps descendant graph loading for views and focused graph components. */
export function useDescendantsGraphQuery(
  input: MaybeRefOrGetter<DescendantsQuery | null>,
  options?: DescendantsGraphQueryOptions
): UseQueryReturnType<DescendantsResult, Error> {
  return useQuery({
    ...descendantsGraphQuery(input),
    ...(options ?? {})
  });
}
