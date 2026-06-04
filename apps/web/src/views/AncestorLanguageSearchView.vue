<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { useIntersectionObserver } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorPathQuery,
  type Language,
  type SourceLanguageLayer,
  type TermsWithAncestorLanguageMatch
} from "@etymology-graph/graph";

import AncestorLanguageResultsAccordion from "../features/ancestorLanguage/AncestorLanguageResultsAccordion.vue";
import AncestorLanguageSearchEmptyState from "../features/ancestorLanguage/AncestorLanguageSearchEmptyState.vue";
import GraphEvidencePanel from "../features/graph/GraphEvidencePanel.vue";
import {
  ancestorPathQueryKey,
  fetchAncestorPath,
  useAncestorPathQuery
} from "../features/ancestorLanguage/composables/useAncestorPathQuery";
import {
  isCuratedAncestorLanguage,
  isCuratedDescendantLanguage,
  resolveAncestorLanguageSuggestions,
  resolveDescendantLanguageOptions,
  type ResolvedAncestorLanguageSuggestion
} from "../features/ancestorLanguage/ancestorLanguageSuggestions";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { useSourceLanguageLayersQuery } from "../features/ancestorLanguage/composables/useSourceLanguageLayersQuery";
import { useTermsWithAncestorLanguageQuery } from "../features/ancestorLanguage/composables/useTermsWithAncestorLanguageQuery";
import { fallbackSearchLanguage, useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import Badge from "../uiComponents/Badge.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Select from "../uiComponents/Select.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

const defaultResultLimit = 24;

type ResultsStatus = "idle" | "loading" | "success" | "empty" | "error";
type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";
type ResolvedSourceLayerSuggestion = ResolvedAncestorLanguageSuggestion & Partial<SourceLanguageLayer>;

const route = useRoute();
const router = useRouter();
const routeDescendantLangCode = computed(() => firstRouteParam(route.params.langCode));
const routeAncestorLangCode = computed(() => firstRouteParam(route.params.ancestorLangCode));
const selectedAncestorLangCode = ref<string>();
const expandedEntryId = ref<string>();
const infiniteScrollSentinel = ref<HTMLElement | null>(null);

const queryClient = useQueryClient();
const searchLanguageStore = useSearchLanguageStore();
const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
const descendantLanguageOptions = computed(() => resolveDescendantLanguageOptions(languages.value));
const descendantLangCode = computed({
  get: () => searchLanguageStore.selectedSearchLanguage,
  set: setDescendantLanguage
});
const ancestorLangCode = computed({
  get: () => selectedAncestorLangCode.value,
  set: setAncestorLanguage
});
const descendantLanguage = computed(() => findLanguage(descendantLangCode.value));
const ancestorLanguage = computed(() => findLanguage(ancestorLangCode.value));
const sourceLayerQueryInput = computed(() =>
  descendantLangCode.value
    ? {
        langCode: descendantLangCode.value,
        maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH
      }
    : null
);
const sourceLayerQuery = useSourceLanguageLayersQuery(sourceLayerQueryInput);
const curatedAncestorSuggestions = computed(() =>
  resolveAncestorLanguageSuggestions(descendantLangCode.value, languages.value)
);
const sourceLayersByAncestorCode = computed(() => {
  const sourceLayers = sourceLayerQuery.data.value?.layers ?? [];

  return new Map(sourceLayers.map((sourceLayer) => [sourceLayer.ancestorLangCode, sourceLayer]));
});
const suggestedAncestors = computed(() =>
  curatedAncestorSuggestions.value.map((suggestion) => ({
    ...suggestion,
    ...sourceLayersByAncestorCode.value.get(suggestion.ancestorLangCode)
  }))
);
const visibleSourceLayerSuggestions = computed<ResolvedSourceLayerSuggestion[]>(() =>
  [...suggestedAncestors.value]
    .filter((suggestion) => suggestion.status === "available")
    .sort((left, right) => (right.matchCount ?? 0) - (left.matchCount ?? 0))
);
const selectedSourceLayerIsAvailable = computed(() =>
  visibleSourceLayerSuggestions.value.some((suggestion) => suggestion.ancestorLangCode === ancestorLangCode.value)
);
const selectedSourceLayerHasMatches = computed(() => {
  const selectedLayer = findSelectedSourceLayer();

  return selectedLayer?.status === "available";
});
const selectedSourceLayer = computed(() =>
  suggestedAncestors.value.find((suggestion) => suggestion.ancestorLangCode === ancestorLangCode.value)
);
const sourceLayerHelpText = computed(() => {
  const descendantName = descendantLanguage.value?.canonicalName;

  return descendantName
    ? `Browse curated source layers and open the ${descendantName} words that trace back to them.`
    : "Choose a language first, then open one of its curated source layers.";
});
const resultQueryInput = computed(() => {
  if (
    !descendantLangCode.value ||
    !ancestorLangCode.value ||
    !selectedSourceLayerIsAvailable.value ||
    !selectedSourceLayerHasMatches.value
  ) {
    return null;
  }

  return {
    langCode: descendantLangCode.value,
    ancestorLangCode: ancestorLangCode.value,
    maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH,
    limit: defaultResultLimit
  };
});
const resultsQuery = useTermsWithAncestorLanguageQuery(resultQueryInput);
const matches = computed(() => resultsQuery.data.value?.pages.flatMap((page) => page.matches) ?? []);
const expandedMatch = computed(() => matches.value.find((match) => match.entry.id === expandedEntryId.value));
const expandedGraphInput = computed<AncestorPathQuery | null>(() => {
  const match = expandedMatch.value;

  if (!match) {
    return null;
  }

  return ancestorPathQueryForMatch(match);
});
const expandedGraphQuery = useAncestorPathQuery(expandedGraphInput);
const resultsStatus = computed<ResultsStatus>(() => {
  if (!resultQueryInput.value) {
    return "idle";
  }

  if (resultsQuery.isPending.value || (resultsQuery.isFetching.value && !resultsQuery.data.value)) {
    return "loading";
  }

  if (resultsQuery.isError.value) {
    return "error";
  }

  return matches.value.length > 0 ? "success" : "empty";
});
const graphStatus = computed<GraphStatus>(() => {
  if (!expandedGraphInput.value) {
    return "idle";
  }

  if (expandedGraphQuery.isPending.value || (expandedGraphQuery.isFetching.value && !expandedGraphQuery.data.value)) {
    return "loading";
  }

  if (expandedGraphQuery.isError.value) {
    return "error";
  }

  return expandedGraphQuery.data.value?.graph ? "success" : "empty";
});
const resultHeading = computed(() => {
  if (!descendantLanguage.value || !ancestorLanguage.value) {
    return "Open a source layer";
  }

  return `${descendantLanguage.value.canonicalName} words from ${ancestorLanguage.value.canonicalName}`;
});
const resultSummary = computed(() => {
  if (!descendantLanguage.value) {
    return "Choose a language to see its source layers.";
  }

  if (!selectedSourceLayer.value) {
    return `Choose a source layer to list ${descendantLanguage.value.canonicalName} words with a shared lineage.`;
  }

  if (selectedSourceLayer.value.status === "available") {
    return selectedSourceLayer.value.description;
  }

  if (selectedSourceLayer.value.status === "empty") {
    return "No paths in the index yet for this source layer.";
  }

  if (selectedSourceLayer.value.status === "unrefreshed") {
    return "This source layer is waiting for coverage.";
  }

  return "Checking coverage for this source layer.";
});
const sourceIndexHeading = computed(() =>
  descendantLanguage.value
    ? `${descendantLanguage.value.canonicalName} source layers`
    : "Source layers"
);

watch([routeDescendantLangCode, routeAncestorLangCode], syncLanguagePairFromRoute, { immediate: true });
watch(languages, ensureValidLanguageSelection, { immediate: true });
watch(visibleSourceLayerSuggestions, ensureDefaultAncestorSelection, { immediate: true });
watch([descendantLangCode, ancestorLangCode], () => {
  expandedEntryId.value = undefined;
});

useIntersectionObserver(
  infiniteScrollSentinel,
  ([entry]) => {
    if (
      entry?.isIntersecting &&
      resultsQuery.hasNextPage.value &&
      !resultsQuery.isFetchingNextPage.value
    ) {
      void resultsQuery.fetchNextPage();
    }
  },
  {
    rootMargin: "240px"
  }
);

/** Defaults the result language to the shared search language so suggestions match the current choice. */
function ensureValidLanguageSelection(availableLanguages: Language[]): void {
  const availableDescendantOptions = resolveDescendantLanguageOptions(availableLanguages);

  if (availableDescendantOptions.length === 0) {
    return;
  }

  if (
    !descendantLangCode.value ||
    !isCuratedDescendantLanguage(descendantLangCode.value) ||
    !hasLanguage(availableLanguages, descendantLangCode.value)
  ) {
    descendantLangCode.value = findPreferredLanguageCode(
      availableLanguages,
      [fallbackSearchLanguage, availableDescendantOptions[0]?.value]
    );
  }

  if (
    selectedAncestorLangCode.value &&
    !isCuratedAncestorLanguage(descendantLangCode.value, selectedAncestorLangCode.value)
  ) {
    selectedAncestorLangCode.value = undefined;
  }
}

/** Opens the first result-bearing source drawer so the atlas starts with useful results. */
function ensureDefaultAncestorSelection(suggestions: ResolvedSourceLayerSuggestion[]): void {
  if (sourceLayerQuery.isPending.value || sourceLayerQuery.isError.value) {
    return;
  }

  const selectionIsVisible = suggestions.some((suggestion) => suggestion.ancestorLangCode === ancestorLangCode.value);
  const firstVisibleSuggestion = suggestions[0];

  if (!selectionIsVisible && firstVisibleSuggestion) {
    ancestorLangCode.value = firstVisibleSuggestion.ancestorLangCode;
  }
}

/** Applies concrete language-pair route params to the shared language preference and local source selection. */
function syncLanguagePairFromRoute([langCode, ancestorLangCode]: readonly [string | undefined, string | undefined]): void {
  if (langCode && isCuratedDescendantLanguage(langCode)) {
    searchLanguageStore.setSelectedSearchLanguage(langCode);
  }

  selectedAncestorLangCode.value = isCuratedAncestorLanguage(langCode, ancestorLangCode)
    ? ancestorLangCode
    : undefined;
}

/** Stores the result language and preserves a curated source layer in the URL when present. */
function setDescendantLanguage(langCode: string | undefined): void {
  searchLanguageStore.setSelectedSearchLanguage(langCode);

  if (
    !langCode ||
    !selectedAncestorLangCode.value ||
    !isCuratedAncestorLanguage(langCode, selectedAncestorLangCode.value)
  ) {
    selectedAncestorLangCode.value = undefined;
    void router.push({ name: "ancestor-language-search" });

    return;
  }

  void router.push({
    name: "ancestor-language-results",
    params: {
      langCode,
      ancestorLangCode: selectedAncestorLangCode.value
    }
  });
}

/** Stores the source language and opens the concrete language-pair route when the pair is complete. */
function setAncestorLanguage(langCode: string | undefined): void {
  selectedAncestorLangCode.value = isCuratedAncestorLanguage(descendantLangCode.value, langCode)
    ? langCode
    : undefined;

  if (!descendantLangCode.value || !selectedAncestorLangCode.value) {
    void router.push({ name: "ancestor-language-search" });

    return;
  }

  void router.push({
    name: "ancestor-language-results",
    params: {
      langCode: descendantLangCode.value,
      ancestorLangCode: selectedAncestorLangCode.value
    }
  });
}

/** Runs a search by committing a suggested source language as the ancestor selection. */
function selectAncestorLanguage(langCode: string): void {
  ancestorLangCode.value = langCode;
}

/** Formats coverage as compact status metadata in the source-layer index. */
function sourceLayerBadgeLabel(suggestion: ResolvedSourceLayerSuggestion): string | undefined {
  if (suggestion.status === "unrefreshed") {
    return "Pending";
  }

  if (suggestion.status === "empty") {
    return "No paths";
  }

  if (suggestion.matchCount !== undefined) {
    return new Intl.NumberFormat().format(suggestion.matchCount);
  }

  return undefined;
}

/** Expands numeric coverage badges for assistive tech and native tooltips. */
function sourceLayerBadgeAccessibleLabel(suggestion: ResolvedSourceLayerSuggestion): string | undefined {
  if (suggestion.matchCount === undefined) {
    return sourceLayerBadgeLabel(suggestion);
  }

  const countLabel = new Intl.NumberFormat().format(suggestion.matchCount);
  const noun = suggestion.matchCount === 1 ? "match" : "matches";

  return `${countLabel} ${noun}`;
}

/** Finds the first candidate language code present in the imported language list. */
function findPreferredLanguageCode(availableLanguages: Language[], candidates: Array<string | undefined>): string | undefined {
  return candidates.find((candidate) =>
    candidate !== undefined && availableLanguages.some((language) => language.code === candidate)
  );
}

/** Checks that a language code is present in the imported language list. */
function hasLanguage(availableLanguages: Language[], langCode: string): boolean {
  return availableLanguages.some((language) => language.code === langCode);
}

/** Looks up language metadata for headings and picker descriptions. */
function findLanguage(langCode: string | undefined): Language | undefined {
  if (!langCode) {
    return undefined;
  }

  return languages.value.find((language) => language.code === langCode);
}

/** Resolves the selected source layer's coverage state from the current atlas response. */
function findSelectedSourceLayer(): SourceLanguageLayer | undefined {
  if (!ancestorLangCode.value) {
    return undefined;
  }

  return sourceLayersByAncestorCode.value.get(ancestorLangCode.value);
}

/** Maps a result row to the graph query used by both expansion and intent prefetching. */
function ancestorPathQueryForMatch(match: TermsWithAncestorLanguageMatch): AncestorPathQuery {
  return {
    langCode: match.entry.langCode,
    word: match.entry.word,
    ancestorLangCode: match.matchedAncestor.langCode,
    ancestorWord: match.matchedAncestor.word,
    maxDepth: Math.max(1, match.depth),
    pos: match.entry.pos,
    etymologyNumber: match.entry.etymologyNumber
  };
}

/** Starts loading graph evidence as soon as a result trigger shows user intent. */
function prefetchAncestorPath(match: TermsWithAncestorLanguageMatch): void {
  const query = ancestorPathQueryForMatch(match);

  void queryClient.prefetchQuery({
    queryKey: ancestorPathQueryKey(query),
    queryFn: ({ signal }) => fetchAncestorPath(query, signal),
    staleTime: 60_000
  });
}

/** Extracts the first string value from Vue Router params. */
function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
</script>

<template>
  <PageMain>
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Word lineages
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Open a drawer of words with the same source.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-page-muted">
        Browse a language by historical layer, then inspect the paths that connect each word back to a shared source.
      </p>
    </section>

    <section
      class="grid gap-5 rounded-[3px] border border-border bg-surface/60 p-4 shadow-paper sm:p-5"
      aria-labelledby="ancestor-language-results"
    >
      <div class="grid gap-5 border-b border-border pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] lg:items-end">
        <div class="grid gap-2">
          <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
            Lineage atlas
          </p>
          <h2 id="ancestor-language-results" class="text-3xl font-black leading-tight tracking-[-0.04em] text-text">
            {{ resultHeading }}
          </h2>
          <p class="max-w-3xl text-base leading-7 text-text-muted">
            {{ resultSummary }}
          </p>
        </div>

        <Select
          id="ancestor-language-descendant"
          v-model="descendantLangCode"
          label="Showing words in"
          :options="descendantLanguageOptions"
          placeholder="Choose a language"
          empty-text="No curated languages found"
          constant-trigger-width
        />
      </div>

      <div class="grid gap-5 lg:grid-cols-[minmax(14rem,19rem)_minmax(0,1fr)] lg:items-start">
        <aside
          class="grid gap-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden"
          aria-labelledby="source-layer-index-heading"
        >
          <div class="grid gap-1">
            <p id="source-layer-index-heading" class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
              {{ sourceIndexHeading }}
            </p>
            <p class="text-sm leading-6 text-text-muted">
              {{ sourceLayerHelpText }}
            </p>
            <p
              v-if="sourceLayerQuery.isPending.value"
              class="font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
            >
              Loading coverage
            </p>
            <p v-else-if="sourceLayerQuery.isError.value" class="text-sm leading-6 text-danger">
              Could not load source-layer coverage.
            </p>
          </div>

          <ul
            v-if="visibleSourceLayerSuggestions.length > 0"
            class="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain lg:pr-1 lg:pb-0"
            aria-label="Source layers"
          >
            <li
              v-for="suggestion in visibleSourceLayerSuggestions"
              :key="suggestion.ancestorLangCode"
              class="min-w-56 lg:min-w-0"
            >
              <button
                type="button"
                class="grid h-full w-full cursor-pointer gap-1 rounded-[3px] border border-border bg-surface/45 p-3 text-left transition hover:bg-surface/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55"
                :class="suggestion.ancestorLangCode === ancestorLangCode ? 'border-accent bg-accent-soft text-text' : ''"
                :aria-pressed="suggestion.ancestorLangCode === ancestorLangCode"
                @click="selectAncestorLanguage(suggestion.ancestorLangCode)"
              >
                <span class="flex items-start justify-between gap-3">
                  <span class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
                    {{ suggestion.ancestorName }}
                  </span>
                  <Badge
                    v-if="sourceLayerBadgeLabel(suggestion)"
                    class="mt-0.5 shrink-0"
                    :aria-label="sourceLayerBadgeAccessibleLabel(suggestion)"
                    :title="sourceLayerBadgeAccessibleLabel(suggestion)"
                  >
                    {{ sourceLayerBadgeLabel(suggestion) }}
                  </Badge>
                </span>
                <span class="text-sm leading-5 text-text-muted">
                  {{ suggestion.description }}
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="text-sm leading-6 text-text-muted">
            No source layers with matches are available for this language yet.
          </p>
        </aside>

        <div class="min-w-0">
          <div
            v-if="resultsStatus === 'idle'"
            class="grid min-h-64 place-items-center rounded-[3px] border border-dashed border-border bg-surface/35 p-6 text-center text-text-muted"
          >
            <div class="grid max-w-md gap-2">
              <p class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
                Choose a source layer
              </p>
              <p class="leading-7">
                Pick a historical source on the left to open its shared word list.
              </p>
            </div>
          </div>

          <div
            v-else-if="resultsStatus === 'loading'"
            class="grid gap-3"
            role="status"
            aria-busy="true"
            aria-label="Loading matching entries"
          >
            <Skeleton
              v-for="item in 4"
              :key="item"
              variant="block"
              tone="raised"
              class="h-25 rounded-[3px] shadow-paper"
            />
          </div>

          <div v-else-if="resultsStatus === 'error'" class="rounded-[3px] border border-danger/50 bg-surface/60 p-5 text-danger shadow-paper">
            Could not load matches for this pair.
          </div>

          <AncestorLanguageSearchEmptyState
            v-else-if="resultsStatus === 'empty'"
            :suggestions="visibleSourceLayerSuggestions"
            :active-ancestor-lang-code="ancestorLangCode"
            @select="selectAncestorLanguage"
          />

          <AncestorLanguageResultsAccordion
            v-else
            v-model="expandedEntryId"
            :matches="matches"
            @prefetch-match="prefetchAncestorPath"
          >
            <template #panel="{ match }">
              <GraphEvidencePanel
                :key="match.entry.id"
                :status="graphStatus"
                :graph="expandedGraphQuery.data.value?.graph ?? null"
                :root-node-id="match.entry.nodeId"
              />
            </template>
          </AncestorLanguageResultsAccordion>

          <div ref="infiniteScrollSentinel" class="min-h-1" aria-hidden="true"></div>
          <div
            v-if="resultsQuery.isFetchingNextPage.value"
            class="mt-3 grid gap-3"
            role="status"
            aria-busy="true"
            aria-label="Loading more matches"
          >
            <Skeleton
              v-for="item in 3"
              :key="item"
              variant="block"
              tone="raised"
              class="h-22 rounded-[3px] shadow-paper"
            />
          </div>
        </div>
      </div>
    </section>
  </PageMain>
</template>
