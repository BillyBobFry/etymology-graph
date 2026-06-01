import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import {
  comparisonSetQuerySchema,
  comparisonSetResultSchema,
  type ComparisonSetQuery,
  type ComparisonSetResult
} from "@etymology-graph/graph";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { buildApiUrl } from "../../apiClient";

export type ComparisonSetQueryKey = readonly ["comparisonSet", ComparisonSetQuery | null];

export type ComparisonSetQueryOptions = Omit<
  UseQueryOptions<ComparisonSetResult, Error, ComparisonSetResult, ComparisonSetResult, ComparisonSetQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds a stable cache key for a curated cognate comparison set. */
export function comparisonSetQueryKey(query: ComparisonSetQuery | null): ComparisonSetQueryKey {
  return ["comparisonSet", query] as const;
}

/** Validates a comparison-set request before it leaves the frontend boundary. */
function resolveComparisonSetQuery(input: MaybeRefOrGetter<ComparisonSetQuery | null>): ComparisonSetQuery | null {
  const query = toValue(input);

  if (query === null) {
    return null;
  }

  return comparisonSetQuerySchema.parse(query);
}

/** Fetches grouped cognate path graphs with one semantic API call. */
export async function fetchComparisonSet(
  input: ComparisonSetQuery,
  signal?: AbortSignal
): Promise<ComparisonSetResult> {
  const query = comparisonSetQuerySchema.parse(input);
  const response = await fetch(buildApiUrl("/api/comparison-set"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(query),
    signal
  });

  if (!response.ok) {
    throw new Error(`Comparison set failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = comparisonSetResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Comparison set response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes TanStack options for grouped sound-change and cognate comparison graph loading. */
export function comparisonSetQuery(
  input: MaybeRefOrGetter<ComparisonSetQuery | null>
): UseQueryOptions<ComparisonSetResult, Error, ComparisonSetResult, ComparisonSetResult, ComparisonSetQueryKey> {
  return {
    queryKey: computed(() => comparisonSetQueryKey(resolveComparisonSetQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveComparisonSetQuery(input);

      if (query === null) {
        throw new Error("Comparison set queries require a selected set");
      }

      return fetchComparisonSet(query, signal);
    },
    enabled: computed(() => resolveComparisonSetQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps comparison-set loading while letting callers override supported query options. */
export function useComparisonSetQuery(
  input: MaybeRefOrGetter<ComparisonSetQuery | null>,
  options?: ComparisonSetQueryOptions
): UseQueryReturnType<ComparisonSetResult, Error> {
  return useQuery({
    ...comparisonSetQuery(input),
    ...(options ?? {})
  });
}
