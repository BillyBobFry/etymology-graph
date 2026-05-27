<script setup lang="ts">
import { useRouter } from "vue-router";

import type { EtymologyGraph, GraphTraversalNode } from "@etymology-graph/graph";

import Button from "./uiComponents/Button.vue";
import GraphCanvas from "./GraphCanvas.vue";
import TermSearchForm from "./TermSearchForm.vue";
import { defaultStarterLangCode, doubletStarterQueries, etymologyStarterQueries } from "./starterQueries";

const homePreviewGraph: EtymologyGraph = {
  rootNodeId: "en:wine",
  nodes: [
    {
      id: "en:wine",
      langCode: "en",
      langName: "English",
      word: "wine",
      normalizedWord: "wine",
      depth: 0,
      lexicalSummary: {
        pos: "noun",
        definition: "An alcoholic drink made by fermenting grape juice."
      }
    },
    {
      id: "la:vinum",
      langCode: "la",
      langName: "Latin",
      word: "vīnum",
      normalizedWord: "vīnum",
      depth: 1,
      lexicalSummary: {
        pos: "noun",
        definition: "Wine."
      }
    },
    {
      id: "ine-pro:*wóyh₁nom",
      langCode: "ine-pro",
      langName: "Proto-Indo-European",
      word: "*wóyh₁nom",
      normalizedWord: "*wóyh₁nom",
      depth: 2
    }
  ],
  edges: [
    {
      id: "en:wine->la:vinum",
      fromNodeId: "en:wine",
      toNodeId: "la:vinum",
      type: "borrowed_from",
      source: "wiktextract"
    },
    {
      id: "la:vinum->ine-pro:*wóyh₁nom",
      fromNodeId: "la:vinum",
      toNodeId: "ine-pro:*wóyh₁nom",
      type: "derived_from",
      source: "wiktextract"
    }
  ],
  maxDepth: 2
};

const router = useRouter();

/** Sends known seed terms straight to their canonical English etymology route. */
function openStarterTerm(term: string): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: defaultStarterLangCode,
      term
    }
  });
}

/** Opens terms with known shared-ancestor doublets in the English seed graph. */
function openDoubletStarterTerm(term: string): void {
  void router.push({
    name: "doublets",
    params: {
      langCode: defaultStarterLangCode,
      term
    }
  });
}

/** Opens the live etymology route from a preview graph node. */
function viewPreviewEtymology(node: GraphTraversalNode): void {
  void router.push({
    name: "etymology",
    params: {
      langCode: node.langCode,
      term: node.word
    }
  });
}

/** Opens the live doublet route from a preview graph node. */
function viewPreviewDoublets(node: GraphTraversalNode): void {
  void router.push({
    name: "doublets",
    params: {
      langCode: node.langCode,
      term: node.word
    }
  });
}
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 text-text sm:gap-10 sm:py-12">
    <section class="border-b border-border-strong pb-8">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Wiktionary-powered graph exploration
      </p>
      <h1 class="mb-4 max-w-3xl text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
        Search a word. Follow its lineage.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Open an imported term, inspect its sources, and follow relationships across inheritance,
        derivation, borrowing, cognates, and doublets.
      </p>
    </section>

    <section class="grid gap-5 border-b border-border pb-8 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Search etymology
        </p>
        <h2 class="max-w-sm text-2xl font-bold leading-tight">
          Choose a language, then open a word page
        </h2>
        <p class="mt-3 max-w-sm leading-7 text-text-muted">
          This is the broadest entry point. Most imported words have an etymology page;
          doublets are available when the graph finds shared ancestry.
        </p>
      </div>
      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <TermSearchForm id-prefix="home-term-search" />
      </div>
    </section>

    <section class="grid gap-5 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] lg:items-stretch">
      <GraphCanvas
        inert
        :graph="homePreviewGraph"
        :root-node-id="homePreviewGraph.rootNodeId"
        :show-controls="false"
        @load-children="viewPreviewEtymology"
        @view-etymology="viewPreviewEtymology"
        @view-doublets="viewPreviewDoublets"
      />

      <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          What you will see
        </p>
        <h2 class="mb-3 text-2xl font-bold leading-tight">
          A graph, plus the source trail
        </h2>
        <p class="leading-7 text-text-muted">
          Result pages combine a navigable graph with entry details, edge types, and source
          metadata from the imported Wiktionary data.
        </p>
      </div>
    </section>

    <section class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
      <div class="mb-5">
        <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
          Starting points
        </p>
        <h2 class="text-2xl font-bold leading-tight">Try a known path through the graph</h2>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="grid gap-3" aria-labelledby="home-etymology-examples">
          <div>
            <h3 id="home-etymology-examples" class="text-lg font-bold leading-7">
              Trace an etymology
            </h3>
            <p class="mt-1 text-sm leading-6 text-text-muted">
              Start with words that have useful ancestry paths in the imported seed data.
            </p>
          </div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <Button
              v-for="query in etymologyStarterQueries"
              :key="query.term"
              variant="secondary"
              full-width
              @click="openStarterTerm(query.term)"
            >
              <span class="grid gap-1 text-left">
                <span>{{ query.term }}</span>
                <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ query.description }}</span>
              </span>
            </Button>
          </div>
        </section>

        <section class="grid gap-3" aria-labelledby="home-doublet-examples">
          <div>
            <h3 id="home-doublet-examples" class="text-lg font-bold leading-7">
              Find doublets
            </h3>
            <p class="mt-1 text-sm leading-6 text-text-muted">
              Try terms with same-language relatives that split from a shared source.
            </p>
          </div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <Button
              v-for="query in doubletStarterQueries"
              :key="query.term"
              variant="secondary"
              full-width
              @click="openDoubletStarterTerm(query.term)"
            >
              <span class="grid gap-1 text-left">
                <span>{{ query.term }}</span>
                <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ query.description }}</span>
              </span>
            </Button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
