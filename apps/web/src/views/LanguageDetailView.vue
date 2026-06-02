<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";

import Link from "../uiComponents/Link.vue";
import PageMain from "../uiComponents/PageMain.vue";
import Skeleton from "../uiComponents/Skeleton.vue";
import { useLanguageDetailQuery } from "../features/languages/useLanguageDetailQuery";

type DetailStatus = "idle" | "loading" | "success" | "error";

const route = useRoute();
const langCode = computed(() => firstRouteParam(route.params.langCode));
const languageDetailQuery = useLanguageDetailQuery(langCode);
const language = computed(() => languageDetailQuery.data.value?.language);
const detailStatus = computed<DetailStatus>(() => {
  if (!langCode.value) {
    return "idle";
  }

  if (languageDetailQuery.isPending.value || (languageDetailQuery.isFetching.value && !languageDetailQuery.data.value)) {
    return "loading";
  }

  return languageDetailQuery.isError.value ? "error" : "success";
});
const sourceLinks = computed(() => {
  const currentLanguage = language.value;

  if (!currentLanguage) {
    return [];
  }

  return [
    currentLanguage.wiktionaryUrl
      ? {
          label: "Wiktionary",
          url: currentLanguage.wiktionaryUrl
        }
      : null,
    currentLanguage.wikidataId
      ? {
          label: "Wikidata",
          url: `https://www.wikidata.org/wiki/${currentLanguage.wikidataId}`
        }
      : null,
    ...currentLanguage.descriptionSourceUrls.map((url) => ({
      label: sourceLabelForUrl(url),
      url
    }))
  ].filter((link): link is { label: string; url: string } => link !== null);
});
const coverageLabel = computed(() => {
  const count = language.value?.graphNodeCount ?? 0;

  if (count === 0) {
    return "No terms in the atlas";
  }

  if (count === 1) {
    return "1 term in the atlas";
  }

  return `${count.toLocaleString()} terms in the atlas`;
});

/** Extracts a single typed route parameter from Vue Router's param shape. */
function firstRouteParam(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }

  return param ?? null;
}

/** Keeps source links readable while preserving the real destination in the URL. */
function sourceLabelForUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    return hostname || "Source";
  } catch {
    return "Source";
  }
}
</script>

<template>
  <PageMain>
    <section v-if="detailStatus === 'loading'" class="grid gap-8" aria-busy="true">
      <div class="border-b border-border-strong pb-8">
        <Skeleton class="mb-4 h-4 w-40" />
        <Skeleton class="mb-5 h-16 w-full max-w-2xl" />
        <Skeleton class="h-6 w-full max-w-3xl" />
      </div>
      <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton class="h-64 rounded-[3px]" />
        <Skeleton class="h-64 rounded-[3px]" />
      </div>
    </section>

    <section v-else-if="detailStatus === 'error'" class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Language not found
      </p>
      <h1 class="mb-4 text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        This language is not in the atlas.
      </h1>
      <p class="mb-6 max-w-3xl text-lg leading-8 text-text-page-muted">
        Check the path or return to a word page to follow a language label from the graph.
      </p>
      <RouterLink
        class="inline-flex w-fit items-center justify-center rounded-md border border-accent bg-accent px-5 py-3 font-label font-bold leading-none text-accent-contrast shadow-paper transition duration-200 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        :to="{ name: 'etymology-search' }"
      >
        Search word lineages
      </RouterLink>
    </section>

    <template v-else-if="language">
      <section class="border-b border-border-strong pb-8">
        <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Language record
        </p>
        <h1 class="text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
          {{ language.canonicalName }}
        </h1>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-text-page-muted">
          {{ language.shortDescription ?? "This language has a reference entry, but no overview has been added yet." }}
        </p>
      </section>

      <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="grid gap-5">
          <section class="rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
            <p class="mb-3 font-label text-xs text-center font-bold uppercase tracking-[0.14em] text-text-muted">
              Ancestor trail
            </p>
            <div v-if="language.ancestors.length > 0" class="grid gap-4">
              <ol
                class="grid justify-items-center gap-5"
                aria-label="Ancestor languages ordered from earliest source to this language"
              >
                <li
                  v-for="ancestor in language.ancestors"
                  :key="ancestor.code"
                  class="grid w-full max-w-xl justify-items-center gap-3"
                >
                  <div class="grid w-full justify-items-center gap-2">
                    <Link class="text-base" :to="{ name: 'language-detail', params: { langCode: ancestor.code } }">
                      {{ ancestor.canonicalName }}
                    </Link>
                    <p v-if="ancestor.shortDescription" class="w-full text-left text-sm leading-6 text-text-muted">
                      {{ ancestor.shortDescription }}
                    </p>
                  </div>
                  <span class="font-label text-sm font-black text-text-muted" aria-hidden="true">↓</span>
                </li>
                <li class="grid w-full max-w-xl justify-items-center">
                  <p class="text-center text-base font-bold text-accent">
                    {{ language.canonicalName }}
                  </p>
                </li>
              </ol>
            </div>
            <p v-else class="text-sm leading-6 text-text-muted">
              No earlier language trail is recorded for this entry yet.
            </p>
          </section>

        </div>

        <aside class="grid content-start gap-4">
          <section class="rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
            <p class="mb-3 font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Sources
            </p>
            <div v-if="sourceLinks.length > 0" class="flex flex-wrap gap-2">
              <Link
                v-for="sourceLink in sourceLinks"
                :key="sourceLink.url"
                :href="sourceLink.url"
                target="_blank"
              >
                {{ sourceLink.label }}
              </Link>
            </div>
            <p v-else class="text-sm leading-6 text-text-muted">
              No public source links are recorded for this language yet.
            </p>
          </section>

          <section class="rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
            <p class="mb-3 font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Family
            </p>
            <p v-if="language.family?.name" class="text-lg font-bold text-text">
              {{ language.family.name }}
            </p>
            <p v-else class="text-sm leading-6 text-text-muted">
              No family is recorded.
            </p>
          </section>

          <section class="rounded-[3px] border border-border bg-surface/60 p-5 shadow-paper">
            <p class="mb-3 font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Coverage
            </p>
            <p class="text-lg font-bold text-text">{{ coverageLabel }}</p>
          </section>
        </aside>
      </section>
    </template>
  </PageMain>
</template>
