<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { type GraphNode, type Language, type SearchTermsQuery } from "@etymology-graph/graph";

import { useLanguagesQuery } from "./composables/useLanguagesQuery";
import { useSearchTermsQuery } from "./composables/useSearchTermsQuery";
import Button from "./uiComponents/Button.vue";
import Combobox from "./uiComponents/Combobox.vue";

const storedLanguageKey = "preferredSearchLanguage";
const searchDebounceMs = 250;

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

const props = withDefaults(
  defineProps<{
    idPrefix: string;
    initialLangCode?: string | null;
    initialTerm?: string | null;
    targetRouteName?: string;
    compact?: boolean;
  }>(),
  {
    initialLangCode: null,
    initialTerm: null,
    targetRouteName: "etymology",
    compact: false
  }
);

const router = useRouter();
const selectedLangCode = ref<string | undefined>(props.initialLangCode ?? undefined);
const selectedSearchResultId = ref<string | undefined>();
const searchTerm = ref(props.initialTerm ?? "");
const searchQueryText = ref("");

const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);

const languageOptions = computed(() =>
  languages.value.map((language) => ({
    value: language.code,
    label: language.canonicalName,
    description: language.code
  }))
);

const selectedLanguage = computed(() =>
  languages.value.find((language) => language.code === selectedLangCode.value)
);

const searchQueryInput = computed<SearchTermsQuery>(() => ({
  query: selectedLangCode.value ? searchQueryText.value : "",
  langCode: selectedLangCode.value,
  limit: 12
}));

const searchTermsQuery = useSearchTermsQuery(searchQueryInput);
const searchResults = computed(() => searchTermsQuery.data.value?.results ?? []);

const searchOptions = computed(() =>
  searchResults.value.map((result) => ({
    value: result.id,
    label: result.word,
    description: searchResultDescription(result)
  }))
);

const searchStatus = computed<SearchStatus>(() => {
  if (!selectedLangCode.value || !searchQueryText.value) {
    return "idle";
  }

  if (searchTermsQuery.isPending.value || (searchTermsQuery.isFetching.value && !searchTermsQuery.data.value)) {
    return "loading";
  }

  if (searchTermsQuery.isError.value) {
    return "error";
  }

  return searchResults.value.length > 0 ? "success" : "empty";
});

const languageHelpText = computed(() => {
  if (languagesQuery.isPending.value) {
    return "Loading imported languages...";
  }

  if (languagesQuery.isError.value) {
    return "Languages could not be loaded.";
  }

  if (!selectedLangCode.value) {
    return "Choose a language before searching terms.";
  }

  return null
});

const searchEmptyText = computed(() => {
  if (!selectedLangCode.value) {
    return "Choose a language first";
  }

  if (searchStatus.value === "loading") {
    return "Searching the selected language...";
  }

  return "No matching terms";
});

watch(languages, chooseInitialLanguage, { immediate: true });
watch(() => props.initialLangCode, syncInitialLanguage);
watch(() => props.initialTerm, syncInitialTerm);
watch(selectedLangCode, persistSelectedLanguage);
watch(selectedLangCode, resetTermSelectionForLanguage);
watch(searchTerm, clearSelectionWhenInputChanges);
watchDebounced(searchTerm, updateSearchQuery, { debounce: searchDebounceMs });
watch(selectedSearchResultId, openSearchResult);

/** Picks a language from route state, user preference, locale, or the first imported language. */
function chooseInitialLanguage(availableLanguages: Language[]): void {
  if (selectedLangCode.value && hasLanguage(availableLanguages, selectedLangCode.value)) {
    return;
  }

  selectedLangCode.value = resolvePreferredLanguage(availableLanguages);
}

/** Keeps the picker aligned when route params move to a different language. */
function syncInitialLanguage(langCode: string | null | undefined): void {
  selectedLangCode.value = langCode ?? resolvePreferredLanguage(languages.value);
}

/** Keeps the term input aligned when route params move to a different term. */
function syncInitialTerm(term: string | null | undefined): void {
  searchTerm.value = term ?? "";
  selectedSearchResultId.value = undefined;
}

/** Persists explicit language choice so locale detection only decides the first visit. */
function persistSelectedLanguage(langCode: string | undefined): void {
  if (!langCode || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storedLanguageKey, langCode);
}

/** Clears term state because the previous selected result belongs to another language. */
function resetTermSelectionForLanguage(): void {
  selectedSearchResultId.value = undefined;
  searchQueryText.value = searchTerm.value.trim();
}

/** Clears committed selection when the user edits away from the selected result label. */
function clearSelectionWhenInputChanges(): void {
  const selectedResult = findSearchResultById(selectedSearchResultId.value);

  if (selectedResult && searchTerm.value !== selectedResult.word) {
    selectedSearchResultId.value = undefined;
  }
}

/** Commits debounced input as query state so TanStack controls fetch timing. */
function updateSearchQuery(): void {
  searchQueryText.value = searchTerm.value.trim();
}

/** Runs an immediate term search while keeping language scoped query state. */
function submitSearch(): void {
  const nextQuery = searchTerm.value.trim();
  const shouldRefetch = Boolean(selectedLangCode.value) && nextQuery.length > 0 && nextQuery === searchQueryText.value;

  searchQueryText.value = nextQuery;

  if (shouldRefetch) {
    void searchTermsQuery.refetch();
  }
}

/** Opens the configured graph route for the chosen term in its selected language. */
function openSearchResult(resultId: string | undefined): void {
  if (resultId === undefined) {
    return;
  }

  const result = findSearchResultById(resultId);

  if (!result) {
    return;
  }

  void router.push({
    name: props.targetRouteName,
    params: {
      langCode: result.langCode,
      term: result.word
    }
  });
}

/** Finds the selected search result backing a combobox option value. */
function findSearchResultById(resultId: string | undefined): GraphNode | undefined {
  if (resultId === undefined) {
    return undefined;
  }

  return searchResults.value.find((candidate) => candidate.id === resultId);
}

/** Builds compact lexical context for search options without changing term-first selection. */
function searchResultDescription(result: GraphNode): string {
  const summaryParts = [
    result.langName ?? result.langCode,
    formatIpa(result),
    result.lexicalSummary?.pos,
    result.lexicalSummary?.definition
  ].filter((part) => part !== undefined && part.length > 0);

  return summaryParts.length > 0 ? summaryParts.join(" · ") : result.id;
}

/** Formats IPA with an accent or region label when Wiktextract provided one. */
function formatIpa(result: GraphNode): string | undefined {
  const ipa = result.lexicalSummary?.ipa;

  if (!ipa) {
    return undefined;
  }

  return result.lexicalSummary?.ipaLabel ? `${ipa} ${result.lexicalSummary.ipaLabel}` : ipa;
}

/** Resolves the best initial language without overriding known route state. */
function resolvePreferredLanguage(availableLanguages: Language[]): string | undefined {
  const storedLanguage = readStoredLanguage();
  const localeLanguage = readLocaleLanguage();
  const candidates = [
    props.initialLangCode,
    storedLanguage,
    localeLanguage,
    "en",
    availableLanguages[0]?.code
  ];

  for (const candidate of candidates) {
    if (candidate && hasLanguage(availableLanguages, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/** Checks that a language code is present in the imported language list. */
function hasLanguage(availableLanguages: Language[], langCode: string): boolean {
  return availableLanguages.some((language) => language.code === langCode);
}

/** Reads the last language the user explicitly chose for term search. */
function readStoredLanguage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(storedLanguageKey);
}

/** Converts browser locale values such as en-US into Wiktionary language codes. */
function readLocaleLanguage(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.language.split("-")[0]?.toLocaleLowerCase() ?? null;
}
</script>

<template>
  <form
    class="grid gap-3"
    :class="compact ? 'lg:grid-cols-[minmax(180px,0.65fr)_minmax(260px,1fr)_auto] lg:items-start' : 'sm:grid-cols-[minmax(180px,0.7fr)_minmax(260px,1fr)_auto] sm:items-start'"
    @submit.prevent="submitSearch"
  >
    <Combobox
      :id="`${idPrefix}-language`"
      v-model="selectedLangCode"
      label="Language"
      :options="languageOptions"
      placeholder="Choose a language"
      autocomplete="off"
      :help-text="languageHelpText"
      :disabled="languagesQuery.isPending.value || languagesQuery.isError.value"
      :empty-text="languagesQuery.isPending.value ? 'Loading languages...' : 'No languages found'"
    >
      <template #option="{ option }">
        <span class="font-label font-bold">{{ option.label }}</span>
        <span class="text-xs leading-5 text-text-muted">{{ option.description }}</span>
      </template>
    </Combobox>

    <Combobox
      :id="`${idPrefix}-term`"
      v-model="selectedSearchResultId"
      v-model:input-value="searchTerm"
      label="Term"
      :options="searchOptions"
      :placeholder="selectedLangCode ? 'bread, father, château...' : 'Choose a language first'"
      autocomplete="off"
      :open-on-click="false"
      :filter-options="false"
      :disabled="!selectedLangCode"
      :empty-text="searchEmptyText"
      close-on-empty
    >
      <template #option="{ option }">
        <span class="font-label font-bold">{{ option.label }}</span>
        <span class="text-xs leading-5 text-text-muted">{{ option.description }}</span>
      </template>
    </Combobox>
  </form>
</template>
