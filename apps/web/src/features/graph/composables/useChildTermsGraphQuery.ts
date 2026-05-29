import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  childTermsQuerySchema,
  childTermsResultSchema,
  type ChildTermsQuery,
  type ChildTermsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type ChildTermsGraphQueryKey = readonly ["childTermsGraph", ChildTermsQuery | null];

export type ChildTermsGraphQueryOptions = Omit<
  UseQueryOptions<ChildTermsResult, Error, ChildTermsResult, ChildTermsResult, ChildTermsGraphQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so repeated direct-child requests reuse graph results. */
export function childTermsGraphQueryKey(query: ChildTermsQuery | null): ChildTermsGraphQueryKey {
  return ["childTermsGraph", query] as const;
}

/** Validates a selected node before loading its direct child terms. */
function resolveChildTermsGraphQuery(
  input: MaybeRefOrGetter<ChildTermsQuery | null>
): ChildTermsQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return childTermsQuerySchema.parse(query);
}

/** Fetches and validates direct child-term graph data from the API boundary. */
export async function fetchChildTermsGraph(
  input: ChildTermsQuery,
  signal?: AbortSignal
): Promise<ChildTermsResult> {
  const query = childTermsQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    limit: String(query.limit)
  });
  if (query.pos !== undefined) {
    params.set("pos", query.pos);
  }
  if (query.etymologyNumber !== undefined) {
    params.set("etymologyNumber", String(query.etymologyNumber));
  }
  const response = await fetch(buildApiUrl(`/api/children?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Child terms graph failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = childTermsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Child terms graph response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for direct child-term loading. */
export function childTermsGraphQuery(
  input: MaybeRefOrGetter<ChildTermsQuery | null>
): UseQueryOptions<ChildTermsResult, Error, ChildTermsResult, ChildTermsResult, ChildTermsGraphQueryKey> {
  return {
    queryKey: computed(() => childTermsGraphQueryKey(resolveChildTermsGraphQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveChildTermsGraphQuery(input);

      if (query === null) {
        throw new Error("Child terms graph queries require a selected term");
      }

      return fetchChildTermsGraph(query, signal);
    },
    enabled: computed(() => resolveChildTermsGraphQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack child-term loading while letting callers override supported query options. */
export function useChildTermsGraphQuery(
  input: MaybeRefOrGetter<ChildTermsQuery | null>,
  options?: ChildTermsGraphQueryOptions
): UseQueryReturnType<ChildTermsResult, Error> {
  return useQuery({
    ...childTermsGraphQuery(input),
    ...(options ?? {})
  });
}
