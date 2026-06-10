<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { normalizeWord, type EtymologyGraph } from "@etymology-graph/graph";

import { plainTextFromGlossarySegments } from "../features/glossary/linguisticGlossary";
import GraphEvidencePanel from "../features/graph/GraphEvidencePanel.vue";
import type { GraphLayoutPreset } from "../features/graph/composables/useGraphLayout";
import { useAncestorGraphQuery } from "../features/graph/composables/useAncestorGraphQuery";
import { primaryGraphNodeHighlights } from "../features/graph/graphNodeHighlights";
import { soundChangeArticles } from "../features/soundChanges/soundChanges";
import { useComparisonSetQuery } from "../features/soundChanges/useComparisonSetQuery";
import Button from "../uiComponents/Button.vue";
import PageMain from "../uiComponents/PageMain.vue";
import {
  featuredAncestorLanguageExamples,
  featuredDoubletExamples,
  featuredEtymologyExamples
} from "./homeFeaturedExamples";
import Divider from "../uiComponents/Divider.vue";

const dayInMs = 86_400_000;
const featuredHomepageGraphCacheTime = dayInMs;
const currentUtcDayIndex = Math.floor(Date.now() / dayInMs);

type GraphEvidenceStatus = "idle" | "loading" | "success" | "empty" | "error";

const featuredEtymologyExample = pickFeaturedExample(featuredEtymologyExamples, 0);
const featuredDoubletExample = pickFeaturedExample(featuredDoubletExamples, 11);
const featuredAncestorLanguageExample = pickFeaturedExample(featuredAncestorLanguageExamples, 23);
const featuredSoundChangeArticles = soundChangeArticles.slice(0, 3);
const featuredEtymologyGraphQuery = useAncestorGraphQuery(() => featuredEtymologyExample.query, {
  staleTime: featuredHomepageGraphCacheTime,
  gcTime: featuredHomepageGraphCacheTime
});
const featuredDoubletGraphQuery = useComparisonSetQuery(() => featuredDoubletExample.query, {
  staleTime: featuredHomepageGraphCacheTime,
  gcTime: featuredHomepageGraphCacheTime
});
const featuredEtymologyGraph = computed(() => featuredEtymologyGraphQuery.data.value?.graph ?? null);
const featuredDoubletGraph = computed(() => featuredDoubletGraphQuery.data.value?.graph ?? null);
const featuredEtymologyGraphStatus = computed(() => graphEvidenceStatus(featuredEtymologyGraphQuery));
const featuredDoubletGraphStatus = computed(() => graphEvidenceStatus(featuredDoubletGraphQuery));
const featuredEtymologyNodeHighlights = computed(() =>
  primaryGraphNodeHighlights(featuredEtymologyGraph.value ? [featuredEtymologyGraph.value.rootNodeId] : [])
);
const featuredDoubletLayoutPreset = computed<GraphLayoutPreset>(() =>
  featuredDoubletGraph.value
    ? { type: "doublet-arms", rootNodeId: featuredDoubletGraph.value.rootNodeId }
    : { type: "auto" }
);
const featuredDoubletNodeHighlights = computed(() =>
  primaryGraphNodeHighlights(
    highlightedTermNodeIds(
      featuredDoubletGraph.value,
      featuredDoubletExample.primaryTerm.langCode,
      featuredDoubletExample.expectedSameLanguageTerms
    )
  )
);

/** Chooses a deterministic daily example so the homepage rotates without backend state. */
function pickFeaturedExample<T>(examples: readonly T[], offset: number): T {
  const example = examples[(currentUtcDayIndex + offset) % examples.length];

  if (!example) {
    throw new Error("Featured example lists must not be empty.");
  }

  return example;
}

/** Normalizes TanStack graph query state into the evidence panel's compact statuses. */
function graphEvidenceStatus(query: {
  data: { value?: { graph?: unknown } };
  isPending: { value: boolean };
  isFetching: { value: boolean };
  isError: { value: boolean };
}): GraphEvidenceStatus {
  if (query.isPending.value || (query.isFetching.value && !query.data.value)) {
    return "loading";
  }

  if (query.isError.value) {
    return "error";
  }

  return query.data.value?.graph ? "success" : "empty";
}

/** Finds featured example nodes by graph identity rather than display casing. */
function highlightedTermNodeIds(graph: EtymologyGraph | null, langCode: string, terms: string[]): string[] {
  if (!graph) {
    return [];
  }

  const normalizedTerms = new Set(terms.map((term) => normalizeWord(term)));

  return graph.nodes
    .filter((node) => node.langCode === langCode && normalizedTerms.has(node.normalizedWord))
    .map((node) => node.id);
}
</script>

<template>
  <PageMain>
    <section>
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
        Etymology graph
      </p>
      <h1 class="mb-5 max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
        Trace words through the languages that shaped them.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-page-muted">
        Search etymologies, compare doublets, and read sound-change articles built from Wiktionary data.
      </p>
    </section>
    <Divider class="mb-12 sm:mb-24" />

    <div class="space-y-36 sm:space-y-52">

    <section class="grid gap-5 pb-10" aria-labelledby="home-etymology-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)] lg:items-stretch">
        <div class="grid content-between gap-6">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
              Etymology
            </p>
            <h2 id="home-etymology-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredEtymologyExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-page-muted">
              {{ featuredEtymologyExample.concept }}
            </p>
          </div>

          <div>
            <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-page-muted">
              Featured today
            </p>
            <h3 class="text-xl font-bold leading-tight">
              {{ featuredEtymologyExample.exampleTitle }}
            </h3>
            <p class="mt-3 leading-7 text-text-page-muted">
              {{ featuredEtymologyExample.exampleText }}
            </p>
            <Button
              :to="{
                name: 'etymology-search'
              }"
              class="mt-5"
            >
              {{ featuredEtymologyExample.ctaLabel }}
            </Button>
          </div>
        </div>

        <GraphEvidencePanel
          :status="featuredEtymologyGraphStatus"
          :graph="featuredEtymologyGraph"
          :node-highlights="featuredEtymologyNodeHighlights"
          class="lg:w-full lg:max-w-3xl lg:justify-self-end"
          loading-label="Loading featured etymology..."
          empty-text="This example is not in the index yet."
          error-text="This featured etymology could not load."
        />
      </div>
    </section>

    <section class="grid gap-5 pb-10" aria-labelledby="home-doublets-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)] lg:items-stretch">
        <div class="grid content-between gap-6 lg:order-2">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
              Doublets
            </p>
            <h2 id="home-doublets-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredDoubletExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-page-muted">
              {{ featuredDoubletExample.concept }}
            </p>
          </div>

          <div>
            <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-page-muted">
              Featured today
            </p>
            <h3 class="text-xl font-bold leading-tight">
              {{ featuredDoubletExample.exampleTitle }}
            </h3>
            <p class="mt-3 leading-7 text-text-page-muted">
              {{ featuredDoubletExample.exampleText }}
            </p>
            <div class="mt-5 flex flex-col gap-3">
              <Button
                :to="{
                  name: 'doublets',
                  params: {
                    langCode: featuredDoubletExample.primaryTerm.langCode,
                    term: featuredDoubletExample.primaryTerm.word
                  }
                }"
                full-width
                class="h-12 text-center"
              >
                {{ featuredDoubletExample.ctaLabel }}
              </Button>
              <Button
                :to="{ name: 'doublet-groups', params: { langCode: featuredDoubletExample.primaryTerm.langCode } }"
                variant="secondary"
                full-width
                class="h-12 text-center"
              >
                {{ featuredDoubletExample.browseCtaLabel }}
              </Button>
            </div>
          </div>
        </div>

        <GraphEvidencePanel
          :status="featuredDoubletGraphStatus"
          :graph="featuredDoubletGraph"
          :layout-preset="featuredDoubletLayoutPreset"
          :node-highlights="featuredDoubletNodeHighlights"
          class="lg:order-1 lg:w-full lg:max-w-3xl lg:justify-self-start"
          loading-label="Loading featured doublet graph..."
          empty-text="This doublet example is not in the index yet."
          error-text="This featured doublet graph could not load."
        />
      </div>
    </section>

    <section class="grid gap-5 pb-10" aria-labelledby="home-sound-changes-heading">
      <div class="grid gap-6 lg:gap-36 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)] lg:items-start">
        <div class="grid content-between gap-6">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
              Sound changes
            </p>
            <h2 id="home-sound-changes-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              Learn why related words stop looking alike.
            </h2>
            <p class="mt-4 leading-7 text-text-page-muted">
              Regular pronunciation shifts can hide a shared source. These articles pair short explanations with graph
              examples, so each pattern stays tied to real word paths.
            </p>
          </div>

          <Button :to="{ name: 'sound-changes' }">
            Browse sound changes
          </Button>
        </div>

        <div class="grid gap-5">
          <div>
            <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-page-muted">
              Current articles
            </p>
            <h3 class="text-2xl font-bold leading-tight">
              Sound-change articles
            </h3>
            <p class="mt-3 max-w-2xl leading-7 text-text-page-muted">
              Start with a named sound change, then open examples that compare related words.
            </p>
          </div>

          <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
            <RouterLink
              v-for="article in featuredSoundChangeArticles"
              :key="article.slug"
              :to="{ name: 'sound-change-article', params: { slug: article.slug } }"
              class="grid h-full gap-2 rounded-[3px] bg-surface/30 p-4 text-left transition hover:bg-surface/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span class="font-label text-xs font-black uppercase tracking-[0.12em] text-text-page-muted">
                {{ article.families.join(" / ") }}
              </span>
              <span class="text-lg font-bold leading-tight text-text">{{ article.title }}</span>
              <span class="text-sm leading-6 text-text-page-muted">
                {{ plainTextFromGlossarySegments(article.overview) }}
              </span>
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="home-word-lineages-heading">
      <div class="grid gap-6 lg:gap-36 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)] lg:items-start">
        <div class="grid gap-6 lg:order-2">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-page-muted">
              Source languages
            </p>
            <h2 id="home-word-lineages-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredAncestorLanguageExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-page-muted">
              {{ featuredAncestorLanguageExample.concept }}
            </p>
          </div>

          <Button
            :to="{
              name: 'ancestor-language-results',
              params: {
                langCode: featuredAncestorLanguageExample.descendantLangCode,
                ancestorLangCode: featuredAncestorLanguageExample.ancestorLangCode
              }
            }"
          >
            {{ featuredAncestorLanguageExample.ctaLabel }}
          </Button>
        </div>

        <div class="grid gap-5 lg:order-1">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-page-muted">
                Featured today
              </p>
              <h3 class="text-2xl font-bold leading-tight">
                {{ featuredAncestorLanguageExample.exampleTitle }}
              </h3>
              <p class="mt-3 max-w-2xl leading-7 text-text-page-muted">
                {{ featuredAncestorLanguageExample.exampleText }}
              </p>
            </div>
            <p class="font-label text-xs font-black uppercase tracking-[0.12em] text-text-page-muted">
              {{ featuredAncestorLanguageExample.descendantLanguage }} to {{ featuredAncestorLanguageExample.ancestorLanguage }}
            </p>
          </div>

          <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
            <RouterLink
              v-for="link in featuredAncestorLanguageExample.links"
              :key="link.term"
              :to="{ name: 'etymology', params: { langCode: featuredAncestorLanguageExample.descendantLangCode, term: link.term } }"
              class="grid h-full content-center gap-2 rounded-[3px] bg-surface/30 p-4 text-left transition hover:bg-surface/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="text-lg font-bold leading-tight text-text">{{ link.term }}</span>
                <span class="font-label text-xs font-black uppercase tracking-[0.12em] text-text-page-muted">
                  reaches {{ link.ancestor }}
                </span>
              </span>
              <span class="text-sm leading-6 text-text-page-muted">{{ link.note }}</span>
            </RouterLink>
          </div>

          <Button
            :to="{ name: 'ancestor-language-search' }"
            variant="secondary"
            size="sm"
            class="mt-5"
          >
            Browse words by source language
          </Button>
        </div>
      </div>
    </section>
  </div>
  </PageMain>
</template>
