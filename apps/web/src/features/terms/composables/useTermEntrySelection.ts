import { computed, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { TermEntriesQuery, TermEntrySummary } from "@etymology-graph/graph";

import { useTermEntriesQuery } from "./useTermEntriesQuery";

export type TermEntrySelection = {
  entries: ComputedRef<TermEntrySummary[]>;
  selectedEntry: ComputedRef<TermEntrySummary | null>;
  selectedPos: ComputedRef<string | undefined>;
  selectedEtymologyNumber: ComputedRef<number | undefined>;
  isLoading: ComputedRef<boolean>;
  selectEntry: (entry: TermEntrySummary) => void;
};

/**
 * Centralises the homograph picker logic shared by ancestor and doublet views: loads the lexical entries
 * homed at a term, picks the one currently anchored by URL query params (or the deterministic default when
 * none is set), and exposes a `selectEntry` action that updates the route's query string.
 */
export function useTermEntrySelection(
  input: MaybeRefOrGetter<{ langCode: string | null; word: string | null }>
): TermEntrySelection {
  const route = useRoute();
  const router = useRouter();
  const queryInput = computed<TermEntriesQuery | null>(() => {
    const value = typeof input === "function" ? input() : "value" in input ? input.value : input;

    if (!value.langCode || !value.word) {
      return null;
    }

    return { langCode: value.langCode, word: value.word };
  });

  const termEntries = useTermEntriesQuery(queryInput);

  const entries = computed<TermEntrySummary[]>(() => termEntries.data.value?.entries ?? []);
  const posParam = computed(() => firstRouteQueryValue(route.query.pos));
  const etymParam = computed<number | undefined>(() => {
    const raw = firstRouteQueryValue(route.query.etym);

    if (raw === null) {
      return undefined;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  });

  const selectedEntry = computed<TermEntrySummary | null>(() => {
    if (entries.value.length === 0) {
      return null;
    }

    if (posParam.value !== null) {
      const targetEtym = etymParam.value ?? 0;
      const match = entries.value.find(
        (entry) => entry.pos === posParam.value && (entry.etymologyNumber ?? 0) === targetEtym
      );
      if (match) {
        return match;
      }
    }

    return entries.value[0];
  });

  return {
    entries,
    selectedEntry,
    selectedPos: computed(() => selectedEntry.value?.pos),
    selectedEtymologyNumber: computed(() => selectedEntry.value?.etymologyNumber),
    isLoading: computed(() => termEntries.isPending.value || termEntries.isFetching.value),
    selectEntry(entry: TermEntrySummary): void {
      const nextQuery = { ...route.query };
      nextQuery.pos = entry.pos ?? null;
      nextQuery.etym = String(entry.etymologyNumber ?? 0);
      void router.push({
        name: route.name ?? undefined,
        params: route.params,
        query: nextQuery
      });
    }
  };
}

/** Extracts the first value from Vue Router's query shape (which may be string, string[], or null). */
function firstRouteQueryValue(value: string | (string | null)[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
