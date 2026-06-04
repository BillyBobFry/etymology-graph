import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  cognatesQuerySchema,
  cognatesResultSchema,
  type CognatesQuery,
  type CognatesResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../../apiClient";

export type CognatesQueryKey = readonly ["cognates", CognatesQuery | null];

export type CognatesQueryOptions = Omit<
  UseQueryOptions<CognatesResult, Error, CognatesResult, CognatesResult, CognatesQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds the cache key for explicit Wiktionary cognate links. */
export function cognatesQueryKey(query: CognatesQuery | null): CognatesQueryKey {
  return ["cognates", query] as const;
}

/** Validates optional cognate input before it reaches TanStack Query state. */
function resolveCognatesQuery(input: MaybeRefOrGetter<CognatesQuery | null>): CognatesQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return cognatesQuerySchema.parse(query);
}

/** Fetches explicit cognates for the selected term. */
export async function fetchCognates(input: CognatesQuery, signal?: AbortSignal): Promise<CognatesResult> {
  const query = cognatesQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    word: query.word,
    limit: String(query.limit)
  });

  if (query.pos) {
    params.set("pos", query.pos);
  }

  if (query.etymologyNumber !== undefined) {
    params.set("etymologyNumber", String(query.etymologyNumber));
  }

  const response = await fetch(buildApiUrl(`/api/cognates?${params.toString()}`), { signal });

  if (!response.ok) {
    throw new Error(`Cognates could not load with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = cognatesResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Cognates response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for term cognate panels. */
export function cognatesQuery(
  input: MaybeRefOrGetter<CognatesQuery | null>
): UseQueryOptions<CognatesResult, Error, CognatesResult, CognatesResult, CognatesQueryKey> {
  return {
    queryKey: computed(() => cognatesQueryKey(resolveCognatesQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveCognatesQuery(input);

      if (query === null) {
        throw new Error("Cognate queries require a selected term");
      }

      return fetchCognates(query, signal);
    },
    enabled: computed(() => resolveCognatesQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps TanStack cognate loading while letting callers override supported query options. */
export function useCognatesQuery(
  input: MaybeRefOrGetter<CognatesQuery | null>,
  options?: CognatesQueryOptions
): UseQueryReturnType<CognatesResult, Error> {
  return useQuery({
    ...cognatesQuery(input),
    ...(options ?? {})
  });
}
