import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  searchTermsQuerySchema,
  searchTermsResultSchema,
  type SearchTermsQuery,
  type SearchTermsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type SearchTermsQueryKey = readonly ["searchTerms", SearchTermsQuery];

export type SearchTermsQueryOptions = Omit<
  UseQueryOptions<SearchTermsResult, Error, SearchTermsResult, SearchTermsResult, SearchTermsQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so all search callers share the same result identity. */
export function searchTermsQueryKey(query: SearchTermsQuery): SearchTermsQueryKey {
  return ["searchTerms", query] as const;
}

/** Normalizes and validates search input before it becomes fetch state. */
function resolveSearchTermsQuery(input: MaybeRefOrGetter<SearchTermsQuery>): SearchTermsQuery {
  const query = searchTermsQuerySchema.parse(toValue(input));

  return {
    ...query,
    query: query.query.trim()
  };
}

/** Fetches and validates search results from the API boundary. */
export async function fetchSearchTerms(
  input: SearchTermsQuery,
  signal?: AbortSignal
): Promise<SearchTermsResult> {
  const query = resolveSearchTermsQuery(input);
  const params = new URLSearchParams({
    q: query.query,
    limit: String(query.limit)
  });

  if (query.langCode) {
    params.set("langCode", query.langCode);
  }

  const response = await fetch(buildApiUrl(`/api/search?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = searchTermsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Search response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for reuse in prefetching or tests. */
export function searchTermsQuery(
  input: MaybeRefOrGetter<SearchTermsQuery>
): UseQueryOptions<SearchTermsResult, Error, SearchTermsResult, SearchTermsResult, SearchTermsQueryKey> {
  return {
    queryKey: computed(() => searchTermsQueryKey(resolveSearchTermsQuery(input))),
    queryFn: ({ signal }) => fetchSearchTerms(resolveSearchTermsQuery(input), signal),
    enabled: computed(() => resolveSearchTermsQuery(input).query.length > 0),
    staleTime: 30_000
  };
}

/** Wraps TanStack search loading while letting callers override supported query options. */
export function useSearchTermsQuery(
  input: MaybeRefOrGetter<SearchTermsQuery>,
  options?: SearchTermsQueryOptions
): UseQueryReturnType<SearchTermsResult, Error> {
  return useQuery({
    ...searchTermsQuery(input),
    ...(options ?? {})
  });
}
