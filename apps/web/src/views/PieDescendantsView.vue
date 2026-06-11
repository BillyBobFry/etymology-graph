<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import DescendantsGraphPanel from "../features/descendants/DescendantsGraphPanel.vue";
import {
  defaultDescendantGraphDepth,
  defaultDescendantGraphLimit,
  maxDescendantGraphDepth,
  maxDescendantGraphLimit
} from "../features/descendants/descendantGraphScope";
import GlossaryText from "../features/glossary/GlossaryText.vue";
import type { GlossaryTextSegment } from "../features/glossary/linguisticGlossary";
import {
  pieDescendantConceptForSlug,
  pieDescendantConcepts,
  type PieDescendantConcept
} from "../features/pieDescendants/pieDescendantConcepts";
import PageMain from "../uiComponents/PageMain.vue";
import ResultsAccordion from "../uiComponents/ResultsAccordion.vue";
import { boundedNumberRouteQueryValue, firstRouteQueryValue } from "../utils/routeQueryValues";

const route = useRoute();
const router = useRouter();

const introSegments: GlossaryTextSegment[] = [
  "Choose a common concept, then inspect the ",
  { text: "descendant", termId: "descendant" },
  " graph from its ",
  { text: "reconstructed", termId: "reconstructed" },
  " Proto-Indo-European source."
];
const pieDefinitionSegments: GlossaryTextSegment[] = [
  "Proto-Indo-European is the ",
  { text: "reconstructed", termId: "reconstructed" },
  " source language behind many words in Europe and parts of Asia. It was not written down directly; linguists infer it by comparing related languages."
];
const pieGraphInterestSegments: GlossaryTextSegment[] = [
  "Instead of tracing one modern word backward, this view starts with an older source and looks forward. The graph shows how one PIE word branches into ",
  { text: "descendant", termId: "descendant" },
  " words across later languages."
];

const selectedConceptSlug = computed(() => firstRouteQueryValue(route.query.concept));
const selectedDepth = computed(() =>
  boundedNumberRouteQueryValue(route.query.depth, defaultDescendantGraphDepth, 1, maxDescendantGraphDepth)
);
const selectedLimit = computed(() =>
  boundedNumberRouteQueryValue(route.query.limit, defaultDescendantGraphLimit, 1, maxDescendantGraphLimit)
);
const conceptIds = computed(() => pieDescendantConcepts.map((concept) => concept.slug));
const expandedConceptSlug = ref<string | undefined>(selectedConceptSlug.value);
const expandedConceptModel = computed({
  get: () => expandedConceptSlug.value,
  set: (slug) => {
    expandedConceptSlug.value = slug;

    if (slug) {
      updateConceptQuery(slug);
    }
  }
});

watch(selectedConceptSlug, (slug) => {
  expandedConceptSlug.value = slug;
});

/** Moves the accordion selection into the route so each opened root can be shared. */
function updateConceptQuery(slug: string): void {
  void router.push({
    name: "pie-descendants",
    query: {
      ...route.query,
      concept: slug,
      depth: String(selectedDepth.value),
      limit: String(selectedLimit.value)
    }
  });
}

/** Looks up a typed concept for the shared accordion slot id. */
function conceptForSlug(slug: string): PieDescendantConcept {
  return pieDescendantConceptForSlug(slug);
}
</script>

<template>
  <PageMain>
    <section class="pb-10">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        PIE descendants
      </p>
      <h1 class="max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] text-text sm:text-7xl">
        See where one old word ends up.
      </h1>
      <p class="mt-5 max-w-3xl text-lg leading-8 text-text-page-muted">
        <GlossaryText :segments="introSegments" />
      </p>
    </section>

    <section class="grid gap-6 pb-10 text-text-page-muted sm:grid-cols-2">
      <div class="max-w-2xl">
        <h2 class="text-2xl font-black leading-tight tracking-[-0.035em] text-text">
          What is Proto-Indo-European?
        </h2>
        <p class="mt-3 leading-7">
          <GlossaryText :segments="pieDefinitionSegments" />
        </p>
      </div>
      <div class="max-w-2xl">
        <h2 class="text-2xl font-black leading-tight tracking-[-0.035em] text-text">
          Why start there?
        </h2>
        <p class="mt-3 leading-7">
          <GlossaryText :segments="pieGraphInterestSegments" />
        </p>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="pie-concepts-heading">
      <div class="grid gap-2">
        <p class="font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
          Common concepts
        </p>
        <h2 id="pie-concepts-heading" class="text-3xl font-black leading-tight tracking-[-0.04em] text-text">
          Select a PIE source word.
        </h2>
      </div>

      <ResultsAccordion
        v-model="expandedConceptModel"
        :item-ids="conceptIds"
        labelled-by="pie-concepts-heading"
      >
        <template #trigger="{ itemId }">
          <span class="grid min-w-0 gap-1.5">
            <span class="truncate text-lg font-black leading-none tracking-[-0.045em] text-text sm:text-xl">
              {{ conceptForSlug(itemId).root.word }}
            </span>
            <span class="font-label text-xs font-bold uppercase tracking-widest text-text-muted sm:text-sm">
              {{ conceptForSlug(itemId).label }}
            </span>
          </span>
        </template>

        <template #panel="{ itemId }">
          <DescendantsGraphPanel
            :root="{ ...conceptForSlug(itemId).root, maxDepth: selectedDepth, limit: selectedLimit }"
            empty-guidance="This source may need broader coverage before its descendants appear here. Try another concept or reduce the graph scope."
          />
        </template>
      </ResultsAccordion>
    </section>
  </PageMain>
</template>
