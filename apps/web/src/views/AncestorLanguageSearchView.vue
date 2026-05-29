<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { useIntersectionObserver } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorPathQuery,
  type Language,
  type TermsWithAncestorLanguageMatch
} from "@etymology-graph/graph";

import AncestorLanguageResultsAccordion from "../features/ancestorLanguage/AncestorLanguageResultsAccordion.vue";
import AncestorLanguageSearchEmptyState from "../features/ancestorLanguage/AncestorLanguageSearchEmptyState.vue";
import AncestorLanguageSuggestions from "../features/ancestorLanguage/AncestorLanguageSuggestions.vue";
import GraphEvidencePanel from "../features/graph/GraphEvidencePanel.vue";
import LanguageSelector from "../features/languages/LanguageSelector.vue";
import {
  ancestorPathQueryKey,
  fetchAncestorPath,
  useAncestorPathQuery
} from "../features/ancestorLanguage/composables/useAncestorPathQuery";
import { resolveAncestorLanguageSuggestions } from "../features/ancestorLanguage/ancestorLanguageSuggestions";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import { useTermsWithAncestorLanguageQuery } from "../features/ancestorLanguage/composables/useTermsWithAncestorLanguageQuery";
import { fallbackSearchLanguage, useSearchLanguageStore } from "../features/terms/searchLanguageStore";
import Skeleton from "../uiComponents/Skeleton.vue";

const defaultResultLimit = 24;

type ResultsStatus = "idle" | "loading" | "success" | "empty" | "error";
type GraphStatus = "idle" | "loading" | "success" | "empty" | "error";

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
const suggestedAncestors = computed(() =>
  resolveAncestorLanguageSuggestions(descendantLangCode.value, languages.value)
);
const suggestionsHelpText = computed(() => {
  const descendantName = descendantLanguage.value?.canonicalName;

  return descendantName
    ? `Pick a source language to find ${descendantName} words that trace back to it.`
    : "Pick a source language to find words that trace back to it.";
});
const resultQueryInput = computed(() => {
  if (!descendantLangCode.value || !ancestorLangCode.value) {
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
    return "Choose two languages";
  }

  return `${descendantLanguage.value.canonicalName} words with ${ancestorLanguage.value.canonicalName} ancestors`;
});

watch([routeDescendantLangCode, routeAncestorLangCode], syncLanguagePairFromRoute, { immediate: true });
watch(languages, ensureValidLanguageSelection, { immediate: true });
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
  if (availableLanguages.length === 0) {
    return;
  }

  if (!descendantLangCode.value || !hasLanguage(availableLanguages, descendantLangCode.value)) {
    descendantLangCode.value = findPreferredLanguageCode(availableLanguages, [fallbackSearchLanguage, availableLanguages[0]?.code]);
  }
}

/** Applies concrete language-pair route params to the shared language preference and local source selection. */
function syncLanguagePairFromRoute([langCode, ancestorLangCode]: readonly [string | undefined, string | undefined]): void {
  if (langCode) {
    searchLanguageStore.setSelectedSearchLanguage(langCode);
  }

  selectedAncestorLangCode.value = ancestorLangCode;
}

/** Stores the result language and preserves a selected source language in the URL when present. */
function setDescendantLanguage(langCode: string | undefined): void {
  searchLanguageStore.setSelectedSearchLanguage(langCode);

  if (!langCode || !selectedAncestorLangCode.value) {
    if (!langCode) {
      void router.push({ name: "ancestor-language-search" });
    }

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
  selectedAncestorLangCode.value = langCode;

  if (!descendantLangCode.value || !langCode) {
    if (!langCode) {
      void router.push({ name: "ancestor-language-search" });
    }

    return;
  }

  void router.push({
    name: "ancestor-language-results",
    params: {
      langCode: descendantLangCode.value,
      ancestorLangCode: langCode
    }
  });
}

/** Runs a search by committing a suggested source language as the ancestor selection. */
function selectAncestorLanguage(langCode: string): void {
  ancestorLangCode.value = langCode;
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

/** Resolves imported language names for evidence labels while keeping code fallbacks. */
function languageLabel(term: { langCode: string; langName?: string }): string {
  return term.langName ?? term.langCode;
}

/** Formats words with language codes so same-spelling terms remain unambiguous. */
function wordLabel(term: { langCode: string; word: string }): string {
  return `${term.langCode}:${term.word}`;
}

/** Extracts the first string value from Vue Router params. */
function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:gap-10 sm:py-12">
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Source language lookup
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        Find links between languages.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Search one language for entries whose ancestry reaches a selected source language.
      </p>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Language pair
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight text-text">
          Set the result language and the source language.
        </h2>
      </div>
      <div class="grid gap-3 rounded-md border border-border bg-surface/75 p-5 shadow-paper sm:grid-cols-2">
        <LanguageSelector
          id="ancestor-language-descendant"
          v-model="descendantLangCode"
          label="Words in"
          placeholder="Choose a language"
        />

        <LanguageSelector
          id="ancestor-language-source"
          v-model="ancestorLangCode"
          label="Ancestor in"
          placeholder="Choose a source language"
        />
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="ancestor-language-results">
      <div class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
            {{ resultsStatus === 'idle' ? 'Starting points' : 'Matches' }}
          </p>
          <h2 id="ancestor-language-results" class="text-2xl font-bold leading-tight text-text">
            {{ resultsStatus === 'idle' ? 'Try an interesting source language' : resultHeading }}
          </h2>
        </div>
      </div>

      <div v-if="resultsStatus === 'idle'" class="grid gap-4">
        <p class="text-sm leading-6 text-text-muted">
          {{ suggestionsHelpText }}
        </p>
        <AncestorLanguageSuggestions :suggestions="suggestedAncestors" @select="selectAncestorLanguage" />
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
          class="h-25 rounded-md shadow-paper"
        />
      </div>

      <div v-else-if="resultsStatus === 'error'" class="rounded-md border border-danger/50 bg-surface/75 p-5 text-danger shadow-paper">
        Ancestor language search failed.
      </div>

      <AncestorLanguageSearchEmptyState
        v-else-if="resultsStatus === 'empty'"
        :suggestions="suggestedAncestors"
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
        class="grid gap-3"
        role="status"
        aria-busy="true"
        aria-label="Loading more matches"
      >
        <Skeleton
          v-for="item in 3"
          :key="item"
          variant="block"
          tone="raised"
          class="h-22 rounded-md shadow-paper"
        />
      </div>
    </section>
  </main>
</template>
