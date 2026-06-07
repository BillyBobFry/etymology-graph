<script setup lang="ts">
import { ArrowRight, Search, X } from "@lucide/vue";
import { watchDebounced } from "@vueuse/core";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";

import type { GraphNode, Language, SearchTermsQuery } from "@etymology-graph/graph";

import Badge from "../../uiComponents/Badge.vue";
import Skeleton from "../../uiComponents/Skeleton.vue";
import { useLanguagesQuery } from "../languages/useLanguagesQuery";
import { useSearchTermsQuery } from "../terms/composables/useSearchTermsQuery";
import { useSearchLanguageStore } from "../terms/searchLanguageStore";
import { commandPaletteActions, type CommandPaletteAction } from "./commandPaletteActions";
import KeyboardHotkey from "../../uiComponents/KeyboardHotkey.vue";
import { commandPaletteTermSearchLanguageCodes } from "./commandPaletteTermSearchLanguages";

type CommandPaletteTermItem = {
  type: "term";
  id: string;
  label: string;
  description: string;
  group: string;
  to: RouteLocationRaw;
};

type CommandPaletteRouteItem = CommandPaletteAction & {
  type: "action";
};

type CommandPaletteLanguageItem = {
  type: "language";
  id: string;
  label: string;
  description: string;
  group: "Languages";
  to: RouteLocationRaw;
};

type CommandPaletteItem = CommandPaletteRouteItem | CommandPaletteTermItem | CommandPaletteLanguageItem;

const maxVisibleItems = 12;
const searchDebounceMs = 180;

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [isOpen: boolean];
}>();

type DocumentOverflowState = {
  body: string;
  html: string;
};

const router = useRouter();
const dialogElement = ref<HTMLDialogElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const resultsScroller = ref<HTMLElement | null>(null);
const documentOverflowBeforeDialog = ref<DocumentOverflowState | null>(null);
const searchLanguageStore = useSearchLanguageStore();
const languagesQuery = useLanguagesQuery();
const queryText = ref("");
const debouncedQueryText = ref("");
const highlightedIndex = ref(0);
const selectedLangCode = computed(() => searchLanguageStore.selectedSearchLanguage);
const selectedTermSearchQueryInput = computed<SearchTermsQuery>(() => ({
  query: selectedLangCode.value ? debouncedQueryText.value : "",
  langCode: selectedLangCode.value,
  hasAncestors: true,
  limit: 3
}));
const selectedTermSearchQuery = useSearchTermsQuery(selectedTermSearchQueryInput);
const commonTermSearchLanguageCodes = computed(() =>
  commandPaletteTermSearchLanguageCodes.filter((languageCode) => languageCode !== selectedLangCode.value)
);
const commonTermSearchQueryInput = computed<SearchTermsQuery>(() => ({
  query: normalizeQuery(debouncedQueryText.value).length >= 2 ? debouncedQueryText.value : "",
  langCodes: [...commonTermSearchLanguageCodes.value],
  hasAncestors: true,
  limit: 8
}));
const commonTermSearchQuery = useSearchTermsQuery(commonTermSearchQueryInput);
const normalizedQuery = computed(() => normalizeQuery(queryText.value));
const matchingLanguageItems = computed<CommandPaletteLanguageItem[]>(() => {
  if (!normalizedQuery.value) {
    return [];
  }

  return (languagesQuery.data.value?.languages ?? [])
    .filter((language) => languageMatchesQuery(language, normalizedQuery.value))
    .map((language) => ({
      type: "language",
      id: `language:${language.code}`,
      label: language.canonicalName,
      description: `Open the ${language.canonicalName} language record.`,
      group: "Languages",
      to: {
        name: "language-detail",
        params: {
          langCode: language.code
        }
      }
    }));
});
const matchingActionItems = computed<CommandPaletteRouteItem[]>(() =>
  commandPaletteActions
    .filter((action) => actionMatchesQuery(action, normalizedQuery.value))
    .map((action) => ({
      ...action,
      type: "action"
    }))
);
const selectedTermResults = computed(() => selectedTermSearchQuery.data.value?.results ?? []);
const commonTermResults = computed(() =>
  (commonTermSearchQuery.data.value?.results ?? []).filter((result) => !selectedTermResultIds.value.has(result.id))
);
const selectedExactTermResultItems = computed<CommandPaletteTermItem[]>(() =>
  selectedTermResults.value.filter(isExactTermResult).map(termResultItem)
);
const selectedFuzzyTermResultItems = computed<CommandPaletteTermItem[]>(() =>
  selectedTermResults.value
    .filter((result) => !isExactTermResult(result))
    .slice(0, commonExactTermResultItems.value.length > 0 ? 1 : selectedTermResults.value.length)
    .map(termResultItem)
);
const commonExactTermResultItems = computed<CommandPaletteTermItem[]>(() =>
  commonTermResults.value.filter(isExactTermResult).map(termResultItem)
);
const commonFuzzyTermResultItems = computed<CommandPaletteTermItem[]>(() =>
  commonTermResults.value
    .filter((result) => !isExactTermResult(result))
    .map(termResultItem)
);
const selectedTermResultIds = computed(
  () => new Set(selectedTermResults.value.map((result) => result.id))
);
const visibleItems = computed<CommandPaletteItem[]>(() => {
  const items = normalizedQuery.value
    ? [
        ...selectedExactTermResultItems.value,
        ...selectedFuzzyTermResultItems.value,
        ...commonExactTermResultItems.value,
        ...commonFuzzyTermResultItems.value,
        ...matchingLanguageItems.value,
        ...matchingActionItems.value
      ]
    : matchingActionItems.value;

  return items.slice(0, maxVisibleItems);
});
const hasVisibleItems = computed(() => visibleItems.value.length > 0);
const openShortcutKeys = computed(() => (isApplePlatform() ? ["⌘", "K"] : ["Ctrl", "K"]));
const isLoadingTermResults = computed(
  () =>
    normalizedQuery.value.length > 0 &&
    (
      selectedTermSearchQuery.isPending.value ||
      selectedTermSearchQuery.isFetching.value ||
      commonTermSearchQuery.isPending.value ||
      commonTermSearchQuery.isFetching.value
    )
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void openPaletteDialog();
      return;
    }

    closePaletteDialog();
  },
  {
    flush: "post"
  }
);
watchDebounced(
  queryText,
  (nextQuery) => {
    debouncedQueryText.value = nextQuery.trim();
  },
  { debounce: searchDebounceMs }
);
watch(visibleItems, () => {
  highlightedIndex.value = Math.min(highlightedIndex.value, Math.max(visibleItems.value.length - 1, 0));
  void scrollHighlightedItemIntoView();
});
watch(queryText, () => {
  highlightedIndex.value = 0;
});
watch(highlightedIndex, () => {
  void scrollHighlightedItemIntoView();
});

onBeforeUnmount(() => {
  closePaletteDialog();
  unlockDocumentScroll();
});

/** Opens the native modal dialog so focus and inert behavior stay platform-owned. */
async function openPaletteDialog(): Promise<void> {
  queryText.value = "";
  debouncedQueryText.value = "";
  highlightedIndex.value = 0;

  await nextTick();

  const dialog = dialogElement.value;

  if (!dialog) {
    return;
  }

  if (!dialog.open) {
    dialog.showModal();
  }

  lockDocumentScroll();

  await nextTick();
  searchInput.value?.focus();
}

/** Closes the native dialog when external state changes or the component unmounts. */
function closePaletteDialog(): void {
  const dialog = dialogElement.value;

  if (dialog?.open) {
    dialog.close();
  }

  unlockDocumentScroll();
}

/** Closes the palette through the component v-model boundary. */
function closePalette(): void {
  emit("update:open", false);
}

/** Keeps parent state aligned when Escape or browser dialog controls close the modal. */
function syncClosedDialogState(): void {
  unlockDocumentScroll();

  if (props.open) {
    emit("update:open", false);
  }
}

/** Lets pointer users dismiss the dialog from the parchment outside the panel. */
function closeFromBackdropClick(event: MouseEvent): void {
  if (event.target === dialogElement.value) {
    closePalette();
  }
}

/** Prevents the underlying atlas page from scrolling while the palette is active. */
function lockDocumentScroll(): void {
  if (documentOverflowBeforeDialog.value) {
    return;
  }

  documentOverflowBeforeDialog.value = {
    body: document.body.style.overflow,
    html: document.documentElement.style.overflow
  };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

/** Restores document scrolling exactly as it was before opening the palette. */
function unlockDocumentScroll(): void {
  const overflowState = documentOverflowBeforeDialog.value;

  if (!overflowState) {
    return;
  }

  document.documentElement.style.overflow = overflowState.html;
  document.body.style.overflow = overflowState.body;
  documentOverflowBeforeDialog.value = null;
}

/** Moves keyboard focus through the result list without changing DOM focus. */
function moveHighlight(delta: number): void {
  if (visibleItems.value.length === 0) {
    return;
  }

  highlightedIndex.value = (highlightedIndex.value + delta + visibleItems.value.length) % visibleItems.value.length;
}

/** Keeps keyboard navigation visually aligned with the active descendant. */
async function scrollHighlightedItemIntoView(): Promise<void> {
  await nextTick();

  const scroller = resultsScroller.value;
  const highlightedItem = visibleItems.value[highlightedIndex.value];

  if (!scroller || !highlightedItem) {
    return;
  }

  const highlightedElement = document.getElementById(highlightedItem.id);

  if (!highlightedElement) {
    return;
  }

  const scrollerBounds = scroller.getBoundingClientRect();
  const itemBounds = highlightedElement.getBoundingClientRect();

  if (itemBounds.bottom > scrollerBounds.bottom) {
    scroller.scrollTop += itemBounds.bottom - scrollerBounds.bottom;
    return;
  }

  if (itemBounds.top < scrollerBounds.top) {
    scroller.scrollTop -= scrollerBounds.top - itemBounds.top;
  }
}

/** Opens the highlighted command when the user presses Enter. */
function selectHighlightedItem(): void {
  const item = visibleItems.value[highlightedIndex.value];

  if (!item) {
    return;
  }

  selectItem(item);
}

/** Navigates to the chosen command target and dismisses the overlay. */
function selectItem(item: CommandPaletteItem): void {
  closePalette();
  void router.push(item.to);
}

/** Normalizes palette matching while preserving the user's visible query. */
function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** Matches labels, descriptions, and curated aliases for compact command search. */
function actionMatchesQuery(action: CommandPaletteAction, query: string): boolean {
  if (!query) {
    return true;
  }

  return [action.label, action.description, ...action.keywords].some((candidate) =>
    candidate.toLocaleLowerCase().includes(query)
  );
}

/** Matches language records by user-facing name or compact language code. */
function languageMatchesQuery(language: Language, query: string): boolean {
  return [language.canonicalName, language.code].some((candidate) =>
    candidate.toLocaleLowerCase().includes(query)
  );
}

/** Identifies high-intent term hits so other languages can surface when their form matches exactly. */
function isExactTermResult(result: GraphNode): boolean {
  return result.normalizedWord === normalizedQuery.value;
}

/** Builds compact context for term suggestions without exposing internal node ids. */
function termResultDescription(result: GraphNode): string {
  const parts = [
    result.lexicalSummary?.pos,
    result.lexicalSummary?.definition
  ].filter((part) => part !== undefined && part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : "Word lineage";
}

/** Converts a graph search result into one navigable palette row. */
function termResultItem(result: GraphNode): CommandPaletteTermItem {
  return {
    type: "term",
    id: `term-result:${result.id}`,
    label: result.word,
    description: termResultDescription(result),
    group: result.langName ?? result.langCode,
    to: {
      name: "etymology",
      params: {
        langCode: result.langCode,
        term: result.word
      }
    }
  };
}

/** Chooses the shortcut label that matches the user's platform. */
function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogElement"
      class="fixed inset-0 m-0 h-dvh w-dvw max-w-none overflow-y-auto border-0 bg-transparent p-0 text-text outline-none backdrop:bg-text/18 backdrop:backdrop-blur-[2px]"
      aria-labelledby="command-palette-title"
      @click="closeFromBackdropClick"
      @close="syncClosedDialogState"
    >
      <div
        class="grid min-h-dvh place-items-start px-4 py-16 sm:py-24"
        role="presentation"
        @click.self="closePalette"
      >
        <section class="mx-auto grid w-full max-w-2xl overflow-hidden rounded-md border border-border-strong bg-surface-raised text-text shadow-overlay">
          <div class="border-b border-border bg-surface/70 p-4">
            <div class="flex items-center gap-3">
              <Search class="shrink-0 text-text-muted" :size="18" stroke-width="2.5" aria-hidden="true" />
              <label id="command-palette-title" class="sr-only" for="command-palette-search">
                Search commands and terms
              </label>
              <input
                id="command-palette-search"
                ref="searchInput"
                v-model="queryText"
                class="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-text-muted/70"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="Search commands..."
                :aria-activedescendant="hasVisibleItems ? visibleItems[highlightedIndex]?.id : undefined"
                aria-controls="command-palette-results"
                aria-expanded="true"
                role="combobox"
                @keydown.down.prevent="moveHighlight(1)"
                @keydown.up.prevent="moveHighlight(-1)"
                @keydown.enter.prevent="selectHighlightedItem"
              />
              <button
                class="rounded-sm p-2 text-text-muted transition hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                type="button"
                aria-label="Close command palette"
                @click="closePalette"
              >
                <X :size="16" stroke-width="2.75" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div ref="resultsScroller" class="max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto p-2">
            <ul
              v-if="hasVisibleItems"
              id="command-palette-results"
              class="grid gap-1"
              role="listbox"
              aria-label="Command palette results"
            >
              <li
                v-for="(item, index) in visibleItems"
                :id="item.id"
                :key="item.id"
                role="option"
                :aria-selected="index === highlightedIndex"
              >
                <button
                  class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[3px] px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  :class="index === highlightedIndex ? 'bg-accent-soft text-text' : 'hover:bg-surface-muted'"
                  type="button"
                  @mouseenter="highlightedIndex = index"
                  @click="selectItem(item)"
                >
                  <span class="grid min-w-0 gap-1">
                    <span class="flex min-w-0 items-center gap-2">
                      <span class="truncate font-label text-sm font-bold">{{ item.label }}</span>
                      <Badge>
                        {{ item.group }}
                      </Badge>
                    </span>
                    <span class="truncate text-sm leading-5 text-text-muted">
                      {{ item.description }}
                    </span>
                  </span>
                  <ArrowRight class="text-text-muted" :size="16" stroke-width="2.5" aria-hidden="true" />
                </button>
              </li>
            </ul>

            <div
              v-else-if="isLoadingTermResults"
              class="grid gap-1"
              role="status"
              aria-busy="true"
              aria-label="Searching terms"
            >
              <div
                v-for="item in 4"
                :key="item"
                class="grid gap-2 rounded-[3px] px-3 py-3"
              >
                <div class="flex items-center gap-2">
                  <Skeleton class="h-4 w-28" />
                  <Skeleton class="h-4 w-18 rounded-full" />
                </div>
                <Skeleton class="h-3 w-full max-w-sm" />
              </div>
            </div>

            <div v-else class="grid gap-2 px-3 py-8 text-center">
              <p class="font-label text-sm font-black uppercase tracking-[0.14em] text-text">
                No matches found
              </p>
              <p class="text-sm leading-6 text-text-muted">
                Try a term, section name, sound change, or glossary word.
              </p>
            </div>
          </div>
          <footer class="items-center justify-between gap-3 border-t border-border bg-surface/55 px-4 py-3 text-xs text-text-muted hidden md:flex">
            <span class="font-label font-bold uppercase tracking-[0.12em]">Toggle palette</span>
            <KeyboardHotkey :keys="openShortcutKeys" />
          </footer>
        </section>
      </div>
    </dialog>
  </Teleport>
</template>
