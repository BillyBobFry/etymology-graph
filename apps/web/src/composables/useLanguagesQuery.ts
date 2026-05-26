import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";

import { languagesResultSchema, type LanguagesResult } from "@etymology-graph/graph";

export type LanguagesQueryKey = readonly ["languages"];

export type LanguagesQueryOptions = Omit<
  UseQueryOptions<LanguagesResult, Error, LanguagesResult, LanguagesResult, LanguagesQueryKey>,
  "queryKey" | "queryFn"
>;

/** Builds a stable cache key for imported language choices. */
export function languagesQueryKey(): LanguagesQueryKey {
  return ["languages"] as const;
}

/** Fetches and validates languages available for term-scoped search. */
export async function fetchLanguages(signal?: AbortSignal): Promise<LanguagesResult> {
  const response = await fetch("/api/languages", { signal });

  if (!response.ok) {
    throw new Error(`Languages failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = languagesResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Languages response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete TanStack query object for language preloading or reuse. */
export function languagesQuery(): UseQueryOptions<
  LanguagesResult,
  Error,
  LanguagesResult,
  LanguagesResult,
  LanguagesQueryKey
> {
  return {
    queryKey: languagesQueryKey(),
    queryFn: ({ signal }) => fetchLanguages(signal),
    staleTime: 5 * 60_000
  };
}

/** Wraps language loading while preserving caller access to TanStack options. */
export function useLanguagesQuery(
  options?: LanguagesQueryOptions
): UseQueryReturnType<LanguagesResult, Error> {
  return useQuery({
    ...languagesQuery(),
    ...(options ?? {})
  });
}
