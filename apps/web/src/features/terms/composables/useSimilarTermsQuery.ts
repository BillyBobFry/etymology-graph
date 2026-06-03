import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  similarTermsQuerySchema,
  similarTermsResultSchema,
  type SimilarTermsQuery,
  type SimilarTermsResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type SimilarTermsQueryKey = readonly ["similarTerms", SimilarTermsQuery | null];

export type SimilarTermsQueryOptions = Omit<
  UseQueryOptions<SimilarTermsResult, Error, SimilarTermsResult, SimilarTermsResult, SimilarTermsQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so similar-term panels reuse the same vector-neighbor response. */
export function similarTermsQueryKey(query: SimilarTermsQuery | null): SimilarTermsQueryKey {
  return ["similarTerms", query] as const;
}

/** Validates optional similar-term input before it reaches TanStack state. */
function resolveSimilarTermsQuery(
  input: MaybeRefOrGetter<SimilarTermsQuery | null>
): SimilarTermsQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return similarTermsQuerySchema.parse(query);
}

/** Fetches and validates terms nearest to the selected term's embedding. */
export async function fetchSimilarTerms(
  input: SimilarTermsQuery,
  signal?: AbortSignal
): Promise<SimilarTermsResult> {
  const query = similarTermsQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    limit: String(query.limit)
  });
  const response = await fetch(buildApiUrl(`/api/similar-terms?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Similar terms could not load with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = similarTermsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Similar terms response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for reuse in pages and tests. */
export function similarTermsQuery(
  input: MaybeRefOrGetter<SimilarTermsQuery | null>
): UseQueryOptions<SimilarTermsResult, Error, SimilarTermsResult, SimilarTermsResult, SimilarTermsQueryKey> {
  return {
    queryKey: computed(() => similarTermsQueryKey(resolveSimilarTermsQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveSimilarTermsQuery(input);

      if (query === null) {
        throw new Error("Similar term queries require a selected term");
      }

      return fetchSimilarTerms(query, signal);
    },
    enabled: computed(() => resolveSimilarTermsQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack similar-term loading while letting callers override supported query options. */
export function useSimilarTermsQuery(
  input: MaybeRefOrGetter<SimilarTermsQuery | null>,
  options?: SimilarTermsQueryOptions
): UseQueryReturnType<SimilarTermsResult, Error> {
  return useQuery({
    ...similarTermsQuery(input),
    ...(options ?? {})
  });
}
