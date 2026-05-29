import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  termEntriesQuerySchema,
  termEntriesResultSchema,
  type TermEntriesQuery,
  type TermEntriesResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type TermEntriesQueryKey = readonly ["termEntries", TermEntriesQuery | null];

export type TermEntriesQueryOptions = Omit<
  UseQueryOptions<TermEntriesResult, Error, TermEntriesResult, TermEntriesResult, TermEntriesQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key so identical term-entries lookups share results across views. */
export function termEntriesQueryKey(query: TermEntriesQuery | null): TermEntriesQueryKey {
  return ["termEntries", query] as const;
}

/** Validates the term-entry lookup input before contacting the API. */
function resolveTermEntriesQuery(
  input: MaybeRefOrGetter<TermEntriesQuery | null>
): TermEntriesQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return termEntriesQuerySchema.parse(query);
}

/** Fetches and validates the list of lexical entries homed at a term. */
export async function fetchTermEntries(
  input: TermEntriesQuery,
  signal?: AbortSignal
): Promise<TermEntriesResult> {
  const query = termEntriesQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word
  });
  const response = await fetch(buildApiUrl(`/api/term-entries?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Term entries lookup failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = termEntriesResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Term entries response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object so callers can reuse it for prefetching. */
export function termEntriesQuery(
  input: MaybeRefOrGetter<TermEntriesQuery | null>
): UseQueryOptions<TermEntriesResult, Error, TermEntriesResult, TermEntriesResult, TermEntriesQueryKey> {
  return {
    queryKey: computed(() => termEntriesQueryKey(resolveTermEntriesQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveTermEntriesQuery(input);

      if (query === null) {
        throw new Error("Term entries queries require a selected term");
      }

      return fetchTermEntries(query, signal);
    },
    enabled: computed(() => resolveTermEntriesQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack term-entries loading while letting callers override supported query options. */
export function useTermEntriesQuery(
  input: MaybeRefOrGetter<TermEntriesQuery | null>,
  options?: TermEntriesQueryOptions
): UseQueryReturnType<TermEntriesResult, Error> {
  return useQuery({
    ...termEntriesQuery(input),
    ...(options ?? {})
  });
}
