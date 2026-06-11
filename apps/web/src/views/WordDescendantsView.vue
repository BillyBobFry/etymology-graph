<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import type { DescendantsQuery } from "@etymology-graph/graph";

import DescendantsGraphPanel from "../features/descendants/DescendantsGraphPanel.vue";
import {
  defaultDescendantGraphDepth,
  defaultDescendantGraphLimit,
  maxDescendantGraphDepth,
  maxDescendantGraphLimit
} from "../features/descendants/descendantGraphScope";
import GlossaryText from "../features/glossary/GlossaryText.vue";
import type { GlossaryTextSegment } from "../features/glossary/linguisticGlossary";
import { useLanguagesQuery } from "../features/languages/useLanguagesQuery";
import PageMain from "../uiComponents/PageMain.vue";
import { boundedNumberRouteQueryValue } from "../utils/routeQueryValues";

const route = useRoute();
const languagesQuery = useLanguagesQuery();

const term = computed(() => firstRouteParam(route.params.term));
const langCode = computed(() => firstRouteParam(route.params.langCode));
const languageName = computed(() => {
  const code = langCode.value;

  if (!code) {
    return "";
  }

  return languagesQuery.data.value?.languages.find((language) => language.code === code)?.canonicalName ?? code;
});
const selectedDepth = computed(() =>
  boundedNumberRouteQueryValue(route.query.depth, defaultDescendantGraphDepth, 1, maxDescendantGraphDepth)
);
const selectedLimit = computed(() =>
  boundedNumberRouteQueryValue(route.query.limit, defaultDescendantGraphLimit, 1, maxDescendantGraphLimit)
);
const descendantsRoot = computed<DescendantsQuery | null>(() => {
  if (!langCode.value || !term.value) {
    return null;
  }

  return {
    langCode: langCode.value,
    word: term.value,
    maxDepth: selectedDepth.value,
    limit: selectedLimit.value
  };
});
const introSegments = computed<GlossaryTextSegment[]>(() => [
  "Follow each ",
  { text: "descendant", termId: "descendant" },
  ` path from this ${languageName.value} source word toward modern languages.`
]);

/** Extracts a single typed route parameter from Vue Router's param shape. */
function firstRouteParam(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }

  return param ?? null;
}
</script>

<template>
  <PageMain>
    <section class="pb-10">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        {{ languageName }} descendants
      </p>
      <h1 class="max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        {{ term }}
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-text-page-muted">
        <GlossaryText :segments="introSegments" />
      </p>
    </section>

    <DescendantsGraphPanel v-if="descendantsRoot" :root="descendantsRoot" />
  </PageMain>
</template>
