import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryFunctionContext,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturnType
} from "@tanstack/vue-query";
import {
  termsWithAncestorLanguageQuerySchema,
  termsWithAncestorLanguageResultSchema,
  type TermsWithAncestorLanguageQuery,
  type TermsWithAncestorLanguageResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

type TermsWithAncestorLanguageBaseQuery = Omit<TermsWithAncestorLanguageQuery, "cursor">;
type TermsWithAncestorLanguagePageParam = string | undefined;

export type TermsWithAncestorLanguageQueryKey = readonly [
  "termsWithAncestorLanguage",
  TermsWithAncestorLanguageBaseQuery | null
];

export type TermsWithAncestorLanguageInfiniteData = InfiniteData<
  TermsWithAncestorLanguageResult,
  TermsWithAncestorLanguagePageParam
>;

export type TermsWithAncestorLanguageQueryOptions = Omit<
  UseInfiniteQueryOptions<
    TermsWithAncestorLanguageResult,
    Error,
    TermsWithAncestorLanguageInfiniteData,
    TermsWithAncestorLanguageQueryKey,
    TermsWithAncestorLanguagePageParam
  >,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

/** Builds the cache key for a descendant-language by ancestor-language result set. */
export function termsWithAncestorLanguageQueryKey(
  query: TermsWithAncestorLanguageBaseQuery | null
): TermsWithAncestorLanguageQueryKey {
  return ["termsWithAncestorLanguage", query] as const;
}

/** Validates the result-list request while keeping cursor state owned by TanStack pages. */
function resolveTermsWithAncestorLanguageQuery(
  input: MaybeRefOrGetter<TermsWithAncestorLanguageBaseQuery | null>
): TermsWithAncestorLanguageBaseQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return termsWithAncestorLanguageQuerySchema.omit({ cursor: true }).parse(query);
}

/** Fetches one page of entries whose ancestor walk reaches the requested source language. */
export async function fetchTermsWithAncestorLanguage(
  input: TermsWithAncestorLanguageBaseQuery,
  cursor?: string,
  signal?: AbortSignal
): Promise<TermsWithAncestorLanguageResult> {
  const query = termsWithAncestorLanguageQuerySchema.parse({
    ...input,
    cursor
  });
  const params = new URLSearchParams({
    langCode: query.langCode,
    ancestorLangCode: query.ancestorLangCode,
    maxDepth: String(query.maxDepth),
    limit: String(query.limit)
  });

  if (query.cursor) {
    params.set("cursor", query.cursor);
  }

  const response = await fetch(buildApiUrl(`/api/terms-with-ancestor-language?${params.toString()}`), {
    signal
  });

  if (!response.ok) {
    throw new Error(`Ancestor language search failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = termsWithAncestorLanguageResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Ancestor language search response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete infinite-query options object for result-list reuse and prefetching. */
export function termsWithAncestorLanguageQuery(
  input: MaybeRefOrGetter<TermsWithAncestorLanguageBaseQuery | null>
): UseInfiniteQueryOptions<
  TermsWithAncestorLanguageResult,
  Error,
  TermsWithAncestorLanguageInfiniteData,
  TermsWithAncestorLanguageQueryKey,
  TermsWithAncestorLanguagePageParam
> {
  return {
    queryKey: computed(() => termsWithAncestorLanguageQueryKey(resolveTermsWithAncestorLanguageQuery(input))),
    queryFn: ({
      signal,
      pageParam
    }: QueryFunctionContext<TermsWithAncestorLanguageQueryKey, TermsWithAncestorLanguagePageParam>) => {
      const query = resolveTermsWithAncestorLanguageQuery(input);

      if (query === null) {
        throw new Error("Ancestor language searches require both languages");
      }

      return fetchTermsWithAncestorLanguage(query, pageParam, signal);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: TermsWithAncestorLanguageResult) => lastPage.nextCursor,
    enabled: computed(() => resolveTermsWithAncestorLanguageQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack infinite loading for ancestor-language result lists. */
export function useTermsWithAncestorLanguageQuery(
  input: MaybeRefOrGetter<TermsWithAncestorLanguageBaseQuery | null>,
  options?: TermsWithAncestorLanguageQueryOptions
): UseInfiniteQueryReturnType<TermsWithAncestorLanguageInfiniteData, Error> {
  return useInfiniteQuery({
    ...termsWithAncestorLanguageQuery(input),
    ...(options ?? {})
  });
}
