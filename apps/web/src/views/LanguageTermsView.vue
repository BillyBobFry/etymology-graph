<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import type { GraphNode } from "@etymology-graph/graph";

import { useLanguageDetailQuery } from "../features/languages/useLanguageDetailQuery";
import { useLanguageTermsQuery } from "../features/languages/useLanguageTermsQuery";
import IpaPronunciation from "../features/pronunciation/IpaPronunciation.vue";
import Button from "../uiComponents/Button.vue";
import Link from "../uiComponents/Link.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";
import TextField from "../uiComponents/TextField.vue";

const defaultTermLimit = 50;

type TermsStatus = "idle" | "loading" | "success" | "empty" | "error";

const route = useRoute();
const router = useRouter();
const langCode = computed(() => firstRouteParam(route.params.langCode));
const routeSearchQuery = computed(() => firstRouteParam(route.query.q)?.trim() ?? "");
const draftSearchQuery = ref(routeSearchQuery.value);
const infiniteScrollSentinel = ref<HTMLElement | null>(null);
const languageDetailQuery = useLanguageDetailQuery(langCode);
const language = computed(() => languageDetailQuery.data.value?.language ?? termsQuery.data.value?.pages[0]?.language);
const termsQueryInput = computed(() => {
  if (!langCode.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    query: routeSearchQuery.value,
    limit: defaultTermLimit,
    connectedOnly: true
  };
});
const termsQuery = useLanguageTermsQuery(termsQueryInput);
const terms = computed(() => termsQuery.data.value?.pages.flatMap((page) => page.terms) ?? []);
const termsStatus = computed<TermsStatus>(() => {
  if (!termsQueryInput.value) {
    return "idle";
  }

  if (termsQuery.isPending.value || (termsQuery.isFetching.value && !termsQuery.data.value)) {
    return "loading";
  }

  if (termsQuery.isError.value || languageDetailQuery.isError.value) {
    return "error";
  }

  return terms.value.length > 0 ? "success" : "empty";
});
const pageTitle = computed(() => (language.value ? `${language.value.canonicalName} terms` : "Language terms"));
const resultHelpText = computed(() => {
  if (!language.value) {
    return "Browse terms with recorded relationships for this language.";
  }

  return routeSearchQuery.value
    ? `Showing matching ${language.value.canonicalName} terms with recorded relationships.`
    : `Browse ${language.value.canonicalName} terms with recorded relationships.`;
});

watch(routeSearchQuery, (query) => {
  draftSearchQuery.value = query;
});

useIntersectionObserver(
  infiniteScrollSentinel,
  ([entry]) => {
    if (entry?.isIntersecting && termsQuery.hasNextPage.value && !termsQuery.isFetchingNextPage.value) {
      void termsQuery.fetchNextPage();
    }
  },
  {
    rootMargin: "240px"
  }
);

/** Extracts a single typed route parameter from Vue Router's param shape. */
function firstRouteParam(param: string | Array<string | null> | null | undefined): string | null {
  if (Array.isArray(param)) {
    return param.find((value): value is string => value !== null) ?? null;
  }

  return param ?? null;
}

/** Applies the term filter to the URL so the index can be shared and reloaded. */
function submitSearch(): void {
  void router.replace({
    name: "language-terms",
    params: {
      langCode: langCode.value
    },
    query: draftSearchQuery.value.trim()
      ? {
          q: draftSearchQuery.value.trim()
        }
      : {}
  });
}

/** Clears the term filter without leaving the language index. */
function clearSearch(): void {
  draftSearchQuery.value = "";
  submitSearch();
}

/** Uses non-pronunciation summary fields beside the interactive IPA guide. */
function termSummaryDetails(term: GraphNode): string {
  const parts = [
    term.lexicalSummary?.pos,
    term.lexicalSummary?.definition
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}
</script>

<template>
  <PageMain>
    <section class="pb-8">
      <Link v-if="langCode" :to="{ name: 'language-detail', params: { langCode } }">
        Back to language record
      </Link>
      <p class="mt-5 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Term index
      </p>
      <h1 class="mt-3 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ pageTitle }}
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-text-page-muted">
        {{ resultHelpText }}
      </p>
    </section>

    <form class="rounded-[3px] border border-border bg-surface/55 p-5" @submit.prevent="submitSearch">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <TextField
          v-model="draftSearchQuery"
          label="Filter terms"
          type="search"
          placeholder="Search within this language"
          autocomplete="off"
        />
        <div class="flex flex-wrap gap-2">
          <Button type="submit">
            Search
          </Button>
          <Button v-if="routeSearchQuery" type="button" variant="secondary" @click="clearSearch">
            Reset
          </Button>
        </div>
      </div>
    </form>

    <section class="grid gap-4" aria-live="polite">
      <div v-if="termsStatus === 'loading'" class="grid gap-3" aria-busy="true">
        <Skeleton v-for="index in 8" :key="index" class="h-20 rounded-[3px]" />
      </div>

      <div v-else-if="termsStatus === 'error'" class="border-y border-border-strong py-6">
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Terms could not load
        </p>
        <p class="mt-2 text-text-page-muted">
          Try refreshing the page or returning to the language record.
        </p>
      </div>

      <div v-else-if="termsStatus === 'empty'" class="border-y border-border-strong py-6">
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          No terms found
        </p>
        <p class="mt-2 text-text-page-muted">
          No indexed terms match this filter.
        </p>
      </div>

      <template v-else>
        <div class="divide-y divide-border border-y border-border-strong">
          <article
            v-for="term in terms"
            :key="term.id"
            class="grid gap-2 px-2 py-4 transition hover:bg-surface/35 sm:px-3"
          >
            <Link
              variant="plain"
              class="w-fit text-2xl font-black tracking-[-0.04em] text-text hover:text-accent"
              :to="{ name: 'etymology', params: { langCode: term.langCode, term: term.word } }"
            >
              {{ term.word }}
            </Link>
            <span
              v-if="term.lexicalSummary?.ipa || termSummaryDetails(term)"
              class="flex flex-wrap items-baseline gap-x-2 text-sm leading-6 text-text-muted"
            >
              <IpaPronunciation
                v-if="term.lexicalSummary?.ipa"
                :ipa="term.lexicalSummary.ipa"
                subtle
              />
              <template v-if="term.lexicalSummary?.ipa && termSummaryDetails(term)">
                <span aria-hidden="true">·</span>
              </template>
              <span v-if="termSummaryDetails(term)">
                {{ termSummaryDetails(term) }}
              </span>
            </span>
          </article>
        </div>

        <div ref="infiniteScrollSentinel" class="min-h-1" aria-hidden="true"></div>
        <div v-if="termsQuery.isFetchingNextPage.value" class="grid gap-3" role="status">
          <Skeleton v-for="index in 3" :key="index" class="h-20 rounded-[3px]" />
        </div>
        <Button
          v-if="termsQuery.hasNextPage.value"
          class="w-fit"
          type="button"
          :loading="termsQuery.isFetchingNextPage.value"
          @click="termsQuery.fetchNextPage()"
        >
          Load more terms
        </Button>
      </template>
    </section>
  </PageMain>
</template>
