import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  sourceLanguageLayersQuerySchema,
  sourceLanguageLayersResultSchema,
  type SourceLanguageLayersQuery,
  type SourceLanguageLayersResult
} from "@etymology-graph/graph";

import { buildApiUrl } from "../../../apiClient";

export type SourceLanguageLayersQueryKey = readonly [
  "sourceLanguageLayers",
  SourceLanguageLayersQuery | null
];

export type SourceLanguageLayersQueryOptions = Omit<
  UseQueryOptions<
    SourceLanguageLayersResult,
    Error,
    SourceLanguageLayersResult,
    SourceLanguageLayersResult,
    SourceLanguageLayersQueryKey
  >,
  "queryKey" | "queryFn"
>;

/** Builds the cache key for curated source-layer coverage. */
export function sourceLanguageLayersQueryKey(
  query: SourceLanguageLayersQuery | null
): SourceLanguageLayersQueryKey {
  return ["sourceLanguageLayers", query] as const;
}

/** Resolves optional source-layer coverage input before TanStack Query runs. */
function resolveSourceLanguageLayersQuery(
  input: MaybeRefOrGetter<SourceLanguageLayersQuery | null>
): SourceLanguageLayersQuery | null {
  const query = toValue(input);

  return query === null ? null : sourceLanguageLayersQuerySchema.parse(query);
}

/** Fetches coverage counts and samples for one atlas language. */
export async function fetchSourceLanguageLayers(
  input: SourceLanguageLayersQuery,
  signal?: AbortSignal
): Promise<SourceLanguageLayersResult> {
  const query = sourceLanguageLayersQuerySchema.parse(input);
  const params = new URLSearchParams({
    langCode: query.langCode,
    maxDepth: String(query.maxDepth)
  });
  const response = await fetch(buildApiUrl(`/api/source-language-layers?${params.toString()}`), {
    signal
  });

  if (!response.ok) {
    throw new Error(`Source language layers failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = sourceLanguageLayersResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Source language layers response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes the complete source-layer coverage query options for reuse. */
export function sourceLanguageLayersQuery(
  input: MaybeRefOrGetter<SourceLanguageLayersQuery | null>
): UseQueryOptions<
  SourceLanguageLayersResult,
  Error,
  SourceLanguageLayersResult,
  SourceLanguageLayersResult,
  SourceLanguageLayersQueryKey
> {
  return {
    queryKey: computed(() => sourceLanguageLayersQueryKey(resolveSourceLanguageLayersQuery(input))),
    queryFn: ({ signal }) => {
      const query = resolveSourceLanguageLayersQuery(input);

      if (query === null) {
        throw new Error("Source language layer coverage requires a language");
      }

      return fetchSourceLanguageLayers(query, signal);
    },
    enabled: computed(() => resolveSourceLanguageLayersQuery(input) !== null),
    staleTime: 60_000
  };
}

/** Wraps source-layer coverage loading for atlas views. */
export function useSourceLanguageLayersQuery(
  input: MaybeRefOrGetter<SourceLanguageLayersQuery | null>,
  options?: SourceLanguageLayersQueryOptions
): UseQueryReturnType<SourceLanguageLayersResult, Error> {
  return useQuery({
    ...sourceLanguageLayersQuery(input),
    ...(options ?? {})
  });
}
