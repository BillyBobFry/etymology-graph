<script setup lang="ts">
import { watchDebounced } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { type GraphNode, type Language, type SearchTermsQuery } from "@etymology-graph/graph";

import LanguageSelector from "../languages/LanguageSelector.vue";
import { useLanguagesQuery } from "../languages/useLanguagesQuery";
import Combobox from "../../uiComponents/Combobox.vue";
import { useSearchTermsQuery } from "./composables/useSearchTermsQuery";
import { fallbackSearchLanguage } from "./searchLanguageStore";

const searchDebounceMs = 250;
const fallbackTermPlaceholder = "Search terms in this language";
const languageTermPlaceholderExamples: Record<string, readonly [string, string, string]> = {
  en: ["bread", "father", "water"],
  es: ["pan", "padre", "agua"],
  pt: ["pão", "pai", "água"],
  fr: ["pain", "père", "eau"],
  it: ["pane", "padre", "acqua"],
  ro: ["pâine", "tată", "apă"],
  de: ["Brot", "Vater", "Wasser"],
  nl: ["brood", "vader", "water"],
  sv: ["bröd", "far", "vatten"],
  da: ["brød", "far", "vand"],
  no: ["brød", "far", "vann"],
  is: ["brauð", "faðir", "vatn"],
  ru: ["хлеб", "отец", "вода"],
  pl: ["chleb", "ojciec", "woda"],
  uk: ["хліб", "батько", "вода"],
  cs: ["chléb", "otec", "voda"],
  bg: ["хляб", "баща", "вода"],
  el: ["ψωμί", "πατέρας", "νερό"],
  hi: ["रोटी", "पिता", "पानी"],
  ur: ["روٹی", "باپ", "پانی"],
  fa: ["نان", "پدر", "آب"],
  ar: ["خبز", "أب", "ماء"],
  tr: ["ekmek", "baba", "su"],
  he: ["לחם", "אב", "מים"],
  zh: ["水", "父亲", "面包"],
  ja: ["水", "父", "パン"],
  ko: ["물", "아버지", "빵"],
  vi: ["nước", "cha", "bánh mì"],
  id: ["roti", "ayah", "air"],
  ms: ["roti", "ayah", "air"],
  th: ["น้ำ", "พ่อ", "ขนมปัง"],
  ta: ["அப்பா", "தண்ணீர்", "அப்பம்"],
  bn: ["রুটি", "বাবা", "জল"],
  sw: ["mkate", "baba", "maji"],
  la: ["pater", "panis", "aqua"],
  grc: ["πατήρ", "ἄρτος", "ὕδωρ"]
};

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

const props = withDefaults(
  defineProps<{
    idPrefix: string;
    langCode?: string | null;
    initialLangCode?: string | null;
    initialTerm?: string | null;
    targetRouteName?: string;
    compact?: boolean;
  }>(),
  {
    langCode: null,
    initialLangCode: null,
    initialTerm: null,
    targetRouteName: "etymology",
    compact: false
  }
);

const emit = defineEmits<{
  "update:langCode": [langCode: string | undefined];
  "language-change": [langCode: string | undefined];
}>();

const router = useRouter();
const selectedLangCode = computed({
  get: () => props.langCode ?? undefined,
  set: (langCode) => handleUserLanguageSelection(langCode)
});
const selectedSearchResultId = ref<string | undefined>();
const searchTerm = ref(props.initialTerm ?? "");
const searchQueryText = ref("");

const languagesQuery = useLanguagesQuery();
const languages = computed(() => languagesQuery.data.value?.languages ?? []);
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
  const nextQuery = searchTerm.value.trim();

  if (!selectedLangCode.value || !nextQuery) {
    return "idle";
  }

  if (nextQuery !== searchQueryText.value) {
    return "loading";
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
  if (!selectedLangCode.value) {
    return "Choose a language before searching terms.";
  }

  return null;
});

const termPlaceholder = computed(() => {
  if (!selectedLangCode.value) {
    return "Choose a language first";
  }

  return formatTermPlaceholder(selectedLangCode.value);
});

const searchEmptyText = computed(() => {
  if (!selectedLangCode.value) {
    return "Choose a language first";
  }

  if (searchStatus.value === "loading") {
    return "Searching the selected language...";
  }

  return "No matches in the index";
});

watch(languages, chooseInitialLanguage, { immediate: true });
watch(() => props.initialLangCode, syncInitialLanguage);
watch(() => props.initialTerm, syncInitialTerm);
watch(searchTerm, clearSelectionWhenInputChanges);
watchDebounced(searchTerm, updateSearchQuery, { debounce: searchDebounceMs });
watch(selectedSearchResultId, openSearchResult);

/** Picks a language from route state, shared selection, or the first imported language. */
function chooseInitialLanguage(availableLanguages: Language[]): void {
  if (availableLanguages.length === 0) {
    return;
  }

  if (props.initialLangCode && hasLanguage(availableLanguages, props.initialLangCode)) {
    applyResolvedLanguage(props.initialLangCode);
    return;
  }

  if (selectedLangCode.value && hasLanguage(availableLanguages, selectedLangCode.value)) {
    return;
  }

  applyResolvedLanguage(resolveSelectedLanguage(availableLanguages));
}

/** Keeps the picker aligned when route params move to a different language. */
function syncInitialLanguage(langCode: string | null | undefined): void {
  applyResolvedLanguage(langCode ?? resolveSelectedLanguage(languages.value));
}

/** Keeps the term input aligned when route params move to a different term. */
function syncInitialTerm(term: string | null | undefined): void {
  searchTerm.value = term ?? "";
  selectedSearchResultId.value = undefined;
}

/** Applies a user-driven language change, clearing the term so the parent can persist or navigate. */
function handleUserLanguageSelection(langCode: string | undefined): void {
  if (langCode === selectedLangCode.value) {
    return;
  }

  emit("update:langCode", langCode);
  resetTermInputForLanguageChange();
  emit("language-change", langCode);
}

/** Aligns the controlled language with resolved route or default state without signalling a user change. */
function applyResolvedLanguage(langCode: string | undefined): void {
  if (langCode === selectedLangCode.value) {
    return;
  }

  emit("update:langCode", langCode);
  resetTermSelectionForLanguage();
}

/** Clears the term input so language-specific starter queries become the next obvious action. */
function resetTermInputForLanguageChange(): void {
  searchTerm.value = "";
  selectedSearchResultId.value = undefined;
  searchQueryText.value = "";
}

/** Clears committed selection because the previous selected result belongs to another language. */
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

/** Builds language-specific starter examples for the term search field. */
function formatTermPlaceholder(langCode: string): string {
  const examples = languageTermPlaceholderExamples[langCode];

  return examples ? `${examples.join(", ")}...` : fallbackTermPlaceholder;
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
function resolveSelectedLanguage(availableLanguages: Language[]): string | undefined {
  const candidates = [
    props.initialLangCode,
    selectedLangCode.value,
    fallbackSearchLanguage,
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

</script>

<template>
  <form
    class="grid gap-3"
    :class="compact ? 'lg:grid-cols-[minmax(180px,0.65fr)_minmax(260px,1fr)_auto] lg:items-start' : 'sm:grid-cols-[minmax(180px,0.7fr)_minmax(260px,1fr)_auto] sm:items-start'"
    @submit.prevent="submitSearch"
  >
    <LanguageSelector
      :id="`${idPrefix}-language`"
      v-model="selectedLangCode"
      label="Language"
      placeholder="Choose a language"
      :help-text="languageHelpText"
    />

    <Combobox
      :id="`${idPrefix}-term`"
      v-model="selectedSearchResultId"
      v-model:input-value="searchTerm"
      label="Term"
      :options="searchOptions"
      :placeholder="termPlaceholder"
      autocomplete="off"
      :open-on-click="false"
      :filter-options="false"
      :disabled="!selectedLangCode"
      :empty-text="searchEmptyText"
      :loading="searchStatus === 'loading'"
      loading-text="Searching terms"
      close-on-empty
    >
      <template #option="{ option }">
        <span class="font-label font-bold">{{ option.label }}</span>
        <span class="text-xs leading-5 text-text-muted">{{ option.description }}</span>
      </template>
    </Combobox>
  </form>
</template>
