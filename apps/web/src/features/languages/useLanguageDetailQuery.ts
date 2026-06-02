import { useQuery, type UseQueryOptions, type UseQueryReturnType } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";

import { languageDetailResultSchema, type LanguageDetailResult } from "@etymology-graph/graph";

import { buildApiUrl } from "../../apiClient";

export type LanguageDetailQueryKey = readonly ["language-detail", string | null];

export type LanguageDetailQueryOptions = Omit<
  UseQueryOptions<LanguageDetailResult, Error, LanguageDetailResult, LanguageDetailResult, LanguageDetailQueryKey>,
  "queryKey" | "queryFn" | "enabled"
>;

const LANGUAGE_DETAIL_QUERY_GC_TIME = 7 * 24 * 60 * 60_000;

/** Builds a stable cache key for one language detail page. */
export function languageDetailQueryKey(langCode: string | null | undefined): LanguageDetailQueryKey {
  return ["language-detail", langCode ?? null] as const;
}

/** Fetches and validates one enriched language detail record. */
export async function fetchLanguageDetail(langCode: string, signal?: AbortSignal): Promise<LanguageDetailResult> {
  const response = await fetch(buildApiUrl(`/api/languages/${encodeURIComponent(langCode)}`), { signal });

  if (!response.ok) {
    throw new Error(response.status === 404 ? "Language not found" : `Language detail failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = languageDetailResultSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Language detail response did not match the expected shape");
  }

  return parsedPayload.data;
}

/** Exposes one language detail query while keeping endpoint keys and validation centralized. */
export function useLanguageDetailQuery(
  langCode: MaybeRefOrGetter<string | null | undefined>,
  options?: LanguageDetailQueryOptions
): UseQueryReturnType<LanguageDetailResult, Error> {
  const resolvedLangCode = computed(() => toValue(langCode) ?? null);

  return useQuery({
    queryKey: computed(() => languageDetailQueryKey(resolvedLangCode.value)),
    queryFn: ({ signal }) => {
      if (!resolvedLangCode.value) {
        throw new Error("Language detail requires a language code");
      }

      return fetchLanguageDetail(resolvedLangCode.value, signal);
    },
    enabled: computed(() => Boolean(resolvedLangCode.value)),
    gcTime: LANGUAGE_DETAIL_QUERY_GC_TIME,
    staleTime: Number.POSITIVE_INFINITY,
    ...(options ?? {})
  });
}
