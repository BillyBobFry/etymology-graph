import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturnType
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  languageTermsQuerySchema,
  languageTermsResultSchema,
  type LanguageTermsQuery,
  type LanguageTermsResult
} from "@etymology-graph/graph";

import { buildApiUrl } from "../../apiClient";

type LanguageTermsBaseQuery = Omit<LanguageTermsQuery, "cursor">;
type LanguageTermsPageParam = string | undefined;

export type LanguageTermsQueryKey = readonly ["languageTerms", LanguageTermsBaseQuery | null];

export type LanguageTermsInfiniteData = InfiniteData<LanguageTermsResult, LanguageTermsPageParam>;

export type LanguageTermsQueryOptions = Omit<
  UseInfiniteQueryOptions<
    LanguageTermsResult,
    Error,
    LanguageTermsInfiniteData,
    LanguageTermsQueryKey,
    LanguageTermsPageParam
  >,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

/** Builds the cache key for one language's term index. */
export function languageTermsQueryKey(query: LanguageTermsBaseQuery | null): LanguageTermsQueryKey {
  return ["languageTerms", query] as const;
}

/** Validates term-index input while keeping cursor state owned by TanStack pages. */
function resolveLanguageTermsQuery(
  input: MaybeRefOrGetter<LanguageTermsBaseQuery | null>
): LanguageTermsBaseQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return languageTermsQuerySchema.omit({ cursor: true }).parse(query);
}

/** Fetches one page of indexed terms for a language. */
export async function fetchLanguageTerms(
  input: LanguageTermsBaseQuery,
  cursor?: string,
  signal?: AbortSignal
): Promise<LanguageTermsResult> {
  const query = languageTermsQuerySchema.parse({
    ...input,
    cursor
  });
  const params = new URLSearchParams({
    query: query.query,
    limit: String(query.limit),
    connectedOnly: String(query.connectedOnly)
  });

  if (query.cursor) {
    params.set("cursor", query.cursor);
  }

  const response = await fetch(buildApiUrl(`/api/languages/${encodeURIComponent(query.langCode)}/terms?${params}`), {
    signal
  });

  if (!response.ok) {
    throw new Error(response.status === 404 ? "Language not found" : `Language terms failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = languageTermsResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Language terms response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes infinite loading for a language term index. */
export function useLanguageTermsQuery(
  input: MaybeRefOrGetter<LanguageTermsBaseQuery | null>,
  options?: LanguageTermsQueryOptions
): UseInfiniteQueryReturnType<LanguageTermsInfiniteData, Error> {
  return useInfiniteQuery({
    queryKey: computed(() => languageTermsQueryKey(resolveLanguageTermsQuery(input))),
    queryFn: ({ signal, pageParam }) => {
      const query = resolveLanguageTermsQuery(input);

      if (query === null) {
        throw new Error("Language terms require a language");
      }

      return fetchLanguageTerms(query, pageParam, signal);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: LanguageTermsResult) => lastPage.nextCursor,
    enabled: computed(() => resolveLanguageTermsQuery(input) !== null),
    staleTime: 60_000,
    ...(options ?? {})
  });
}
