<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import {
  DEFAULT_ANCESTOR_MAX_DEPTH,
  type AncestorsQuery,
  type DoubletsQuery
} from "@etymology-graph/graph";

import GraphEvidencePanel from "../features/graph/GraphEvidencePanel.vue";
import { useAncestorGraphQuery } from "../features/graph/composables/useAncestorGraphQuery";
import { useDoubletGraphQuery } from "../features/graph/composables/useDoubletGraphQuery";
import type { GraphLayoutPreset } from "../features/graph/composables/useGraphLayout";

type GraphEvidenceStatus = "idle" | "loading" | "success" | "empty" | "error";

type FeaturedGraphExample<TQuery> = {
  heading: string;
  concept: string;
  exampleTitle: string;
  exampleText: string;
  query: TQuery;
  ctaLabel: string;
  layoutPreset?: GraphLayoutPreset;
};

type FeaturedDoubletExample = FeaturedGraphExample<DoubletsQuery> & {
  browseCtaLabel: string;
};

type AncestorLanguageLink = {
  term: string;
  ancestor: string;
  note: string;
};

type FeaturedAncestorLanguageExample = {
  heading: string;
  concept: string;
  exampleTitle: string;
  exampleText: string;
  descendantLangCode: string;
  descendantLanguage: string;
  ancestorLangCode: string;
  ancestorLanguage: string;
  ctaLabel: string;
  links: AncestorLanguageLink[];
};

const dayInMs = 86_400_000;
const featuredGraphLimit = 18;
const currentUtcDayIndex = Math.floor(Date.now() / dayInMs);
const primaryLinkClass =
  "inline-flex w-fit items-center justify-center rounded-lg border border-accent bg-accent px-5 py-3 font-label text-base font-bold leading-none text-accent-contrast shadow-paper transition duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const secondaryLinkClass =
  "inline-flex w-fit items-center justify-center rounded-lg border border-border-strong bg-surface-muted px-4 py-2.5 font-label text-sm font-bold leading-none text-text transition duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const featuredEtymologyExamples: Array<FeaturedGraphExample<AncestorsQuery>> = [
  {
    heading: "Etymology follows one word back through time.",
    concept:
      "An etymology traces a word through earlier spellings, source languages, and older roots. The graph shows each step as a relationship that points back toward a source.",
    exampleTitle: "wine passes through Latin",
    exampleText:
      "English wine is a compact example of borrowing. The word travels through Latin before the trail reaches a much older Indo-European form.",
    ctaLabel: "Trace wine",
    query: { langCode: "en", word: "wine", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Inherited words keep older family lines visible.",
    concept:
      "Some common words were not borrowed recently. They were inherited through generations of speech, leaving a deep trail of related forms.",
    exampleTitle: "father keeps an old kinship root",
    exampleText:
      "Kinship words are often stable. Father links English to Old English, Proto-Germanic, and an older Indo-European family term.",
    ctaLabel: "Trace father",
    query: { langCode: "en", word: "father", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Learned words can preserve classroom routes.",
    concept:
      "A familiar modern word may have travelled through institutions, translation, and scholarly borrowing before it entered everyday use.",
    exampleTitle: "school keeps a Greek source visible",
    exampleText:
      "School reaches English through Latin, then back to Ancient Greek. The graph turns that chain into a readable source path.",
    ctaLabel: "Trace school",
    query: { langCode: "en", word: "school", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Borrowed words can carry political history.",
    concept:
      "Etymology is often a record of contact between languages. A word can show who borrowed from whom, and which source shaped the modern form.",
    exampleTitle: "royal enters English through French",
    exampleText:
      "Royal points to Old French and then Latin. The route makes the Norman and Latin layers of English vocabulary visible.",
    ctaLabel: "Trace royal",
    query: { langCode: "en", word: "royal", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Trade words often travel across many languages.",
    concept:
      "Borrowing chains can be long. A material, food, or technology word may pass through several languages before it reaches the one you use now.",
    exampleTitle: "sugar records a trade route",
    exampleText:
      "Sugar is useful because the path is not a single jump. The word shows how goods and names can move together.",
    ctaLabel: "Trace sugar",
    query: { langCode: "en", word: "sugar", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  },
  {
    heading: "Everyday words can reach very old roots.",
    concept:
      "The most ordinary words can have the deepest trails. A graph helps separate the modern word from the older forms behind it.",
    exampleTitle: "night preserves an old sky-word",
    exampleText:
      "Night connects English to Old English, Proto-Germanic, and an Indo-European root shared across many related languages.",
    ctaLabel: "Trace night",
    query: { langCode: "en", word: "night", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH }
  }
];

const featuredDoubletExamples: FeaturedDoubletExample[] = [
  {
    heading: "Doublets are two words from one source.",
    concept:
      "A doublet appears when related words enter the same language by different routes. The words look separate, but the graph reveals a shared ancestor.",
    exampleTitle: "fragile and frail share Latin",
    exampleText:
      "Fragile and frail split through different historical paths. Both reconnect at Latin fragilis.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "fragile", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "A sound change can hide a family resemblance.",
    concept:
      "Doublets are useful because they show where spelling and sound have drifted apart. A shared root can survive behind very different surfaces.",
    exampleTitle: "shirt and skirt reconnect",
    exampleText:
      "Shirt and skirt look like ordinary clothing words. Their paths lead back to closely related Germanic forms.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "shirt", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Borrowing can duplicate an older word.",
    concept:
      "A language can inherit one form and later borrow a cousin. The result is a pair of words with separate lives and shared ancestry.",
    exampleTitle: "ward and guard show two routes",
    exampleText:
      "Ward and guard are connected through Germanic and French contact. The graph makes the double route visible.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "ward", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Technical words often arrive twice.",
    concept:
      "Specialized vocabulary can enter through different institutions or periods. Doublet search groups those separate entries by their older source.",
    exampleTitle: "channel and canal share a source",
    exampleText:
      "Channel and canal both point back to Latin canālis, but they reached English through different routes.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "channel", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "One root can produce a small word family.",
    concept:
      "Some doublet searches reveal more than a pair. Several English words can reconnect through the same source.",
    exampleTitle: "chief, chef, and capital point to head",
    exampleText:
      "These words travelled through different Romance routes. Their older connection is the Latin word for head.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "chief", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  },
  {
    heading: "Legal and everyday senses can split apart.",
    concept:
      "Doublets are not only sound history. They also show how related forms specialize into different meanings.",
    exampleTitle: "warranty and guarantee reconnect",
    exampleText:
      "Warranty and guarantee belong to the same protection family, but entered English through different legal and commercial routes.",
    ctaLabel: "Open this doublet graph",
    browseCtaLabel: "See more English doublets",
    layoutPreset: "doublet-arms",
    query: { langCode: "en", word: "warranty", maxDepth: DEFAULT_ANCESTOR_MAX_DEPTH, limit: featuredGraphLimit }
  }
];

const featuredAncestorLanguageExamples: FeaturedAncestorLanguageExample[] = [
  {
    heading: "A source language can explain a whole set of words.",
    concept:
      "Instead of starting from one word, choose a modern language and an older source language. The app finds entries whose lineage reaches that source.",
    exampleTitle: "English words with Latin ancestors",
    exampleText:
      "Latin sits behind many English learned, legal, religious, and political terms. The results page groups those paths into browsable matches.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "la",
    ancestorLanguage: "Latin",
    ctaLabel: "Browse English from Latin",
    links: [
      { term: "royal", ancestor: "rēx", note: "political vocabulary" },
      { term: "fragile", ancestor: "fragilis", note: "learned adjective" },
      { term: "channel", ancestor: "canālis", note: "route and passage words" }
    ]
  },
  {
    heading: "Older scholarly sources leave clusters in modern languages.",
    concept:
      "A source-language search shows where one older language feeds many modern entries, even when each word has its own route.",
    exampleTitle: "English words with Ancient Greek ancestors",
    exampleText:
      "Ancient Greek appears in school, science, literature, and technical vocabulary. The result list lets you open each path.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "grc",
    ancestorLanguage: "Ancient Greek",
    ctaLabel: "Browse English from Greek",
    links: [
      { term: "school", ancestor: "σχολή", note: "education vocabulary" },
      { term: "cycle", ancestor: "κύκλος", note: "wheel and circle words" },
      { term: "character", ancestor: "χαρακτήρ", note: "writing and mark words" }
    ]
  },
  {
    heading: "Contact between cultures becomes visible at language scale.",
    concept:
      "Source-language search is useful for contact history. It asks which entries in one language trace back through another.",
    exampleTitle: "Spanish words with Arabic ancestors",
    exampleText:
      "Arabic influence on Spanish is visible across food, trade, science, and everyday vocabulary.",
    descendantLangCode: "es",
    descendantLanguage: "Spanish",
    ancestorLangCode: "ar",
    ancestorLanguage: "Arabic",
    ctaLabel: "Browse Spanish from Arabic",
    links: [
      { term: "azúcar", ancestor: "سُكَّر", note: "food and trade" },
      { term: "naranja", ancestor: "نارنج", note: "fruit names" },
      { term: "aceite", ancestor: "زيت", note: "household vocabulary" }
    ]
  },
  {
    heading: "A source language can reveal inherited everyday vocabulary.",
    concept:
      "The same query can find old inherited words, not only recent borrowings. It turns a language pair into a map of ancestry.",
    exampleTitle: "English words with Old Norse ancestors",
    exampleText:
      "Old Norse contact left common English words that still feel ordinary today.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "non",
    ancestorLanguage: "Old Norse",
    ctaLabel: "Browse English from Old Norse",
    links: [
      { term: "skirt", ancestor: "skyrta", note: "clothing vocabulary" },
      { term: "sky", ancestor: "ský", note: "weather and landscape" },
      { term: "egg", ancestor: "egg", note: "everyday nouns" }
    ]
  },
  {
    heading: "Deep ancestry connects basic words across families.",
    concept:
      "Choosing a reconstructed source language shows where basic vocabulary reaches far behind written records.",
    exampleTitle: "English words with Indo-European ancestors",
    exampleText:
      "Many English kinship, number, body, and nature words trace back to reconstructed Indo-European roots.",
    descendantLangCode: "en",
    descendantLanguage: "English",
    ancestorLangCode: "ine-pro",
    ancestorLanguage: "Proto-Indo-European",
    ctaLabel: "Browse English from Indo-European",
    links: [
      { term: "father", ancestor: "*ph₂tḗr", note: "kinship terms" },
      { term: "night", ancestor: "*nókʷts", note: "time and sky words" },
      { term: "three", ancestor: "*tréyes", note: "number words" }
    ]
  }
];

const featuredEtymologyExample = pickFeaturedExample(featuredEtymologyExamples, 0);
const featuredDoubletExample = pickFeaturedExample(featuredDoubletExamples, 11);
const featuredAncestorLanguageExample = pickFeaturedExample(featuredAncestorLanguageExamples, 23);
const featuredEtymologyGraphQuery = useAncestorGraphQuery(() => featuredEtymologyExample.query);
const featuredDoubletGraphQuery = useDoubletGraphQuery(() => featuredDoubletExample.query);
const featuredEtymologyGraphStatus = computed(() => graphEvidenceStatus(featuredEtymologyGraphQuery));
const featuredDoubletGraphStatus = computed(() => graphEvidenceStatus(featuredDoubletGraphQuery));

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
</script>

<template>
  <main class="mx-auto grid max-w-6xl gap-10 px-6 py-8 text-text sm:gap-12 sm:py-12">
    <section class="border-b border-border-strong pb-10">
      <p class="mb-3 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
        Wiktionary-powered graph exploration
      </p>
      <h1 class="mb-5 max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">
        Explore how words inherit, borrow, split, and reconnect.
      </h1>
      <p class="max-w-3xl text-lg leading-8 text-text-muted">
        Learn the main ways to use the graph through featured examples. Trace one word,
        compare doublets, or browse entries that reach back to a source language.
      </p>
    </section>

    <section class="grid gap-5 border-b border-border pb-10" aria-labelledby="home-etymology-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)] lg:items-stretch">
        <div class="grid content-between gap-6">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
              Etymology
            </p>
            <h2 id="home-etymology-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredEtymologyExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-muted">
              {{ featuredEtymologyExample.concept }}
            </p>
          </div>

          <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
            <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-muted">
              Featured today
            </p>
            <h3 class="text-xl font-bold leading-tight">
              {{ featuredEtymologyExample.exampleTitle }}
            </h3>
            <p class="mt-3 leading-7 text-text-muted">
              {{ featuredEtymologyExample.exampleText }}
            </p>
            <RouterLink
              :to="{
                name: 'etymology',
                params: {
                  langCode: featuredEtymologyExample.query.langCode,
                  term: featuredEtymologyExample.query.word
                }
              }"
              :class="primaryLinkClass"
              class="mt-5"
            >
              {{ featuredEtymologyExample.ctaLabel }}
            </RouterLink>
          </div>
        </div>

        <GraphEvidencePanel
          :status="featuredEtymologyGraphStatus"
          :graph="featuredEtymologyGraphQuery.data.value?.graph ?? null"
          :root-node-id="featuredEtymologyGraphQuery.data.value?.graph?.rootNodeId"
          :layout-preset="featuredEtymologyExample.layoutPreset"
          loading-label="Loading featured etymology..."
          empty-text="This featured etymology is not in the current local dataset."
          error-text="Featured etymology failed to load."
        />
      </div>
    </section>

    <section class="grid gap-5 border-b border-border pb-10" aria-labelledby="home-doublets-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)] lg:items-stretch">
        <GraphEvidencePanel
          :status="featuredDoubletGraphStatus"
          :graph="featuredDoubletGraphQuery.data.value?.graph ?? null"
          :root-node-id="featuredDoubletGraphQuery.data.value?.graph?.rootNodeId"
          :layout-preset="featuredDoubletExample.layoutPreset"
          loading-label="Loading featured doublet graph..."
          empty-text="This featured doublet graph is not in the current local dataset."
          error-text="Featured doublet graph failed to load."
        />

        <div class="grid content-between gap-6">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
              Doublets
            </p>
            <h2 id="home-doublets-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredDoubletExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-muted">
              {{ featuredDoubletExample.concept }}
            </p>
          </div>

          <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
            <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-muted">
              Featured today
            </p>
            <h3 class="text-xl font-bold leading-tight">
              {{ featuredDoubletExample.exampleTitle }}
            </h3>
            <p class="mt-3 leading-7 text-text-muted">
              {{ featuredDoubletExample.exampleText }}
            </p>
            <div class="mt-5 flex flex-wrap gap-3">
              <RouterLink
                :to="{
                  name: 'doublets',
                  params: {
                    langCode: featuredDoubletExample.query.langCode,
                    term: featuredDoubletExample.query.word
                  }
                }"
                :class="primaryLinkClass"
              >
                {{ featuredDoubletExample.ctaLabel }}
              </RouterLink>
              <RouterLink
                :to="{ name: 'doublet-groups', params: { langCode: featuredDoubletExample.query.langCode } }"
                :class="secondaryLinkClass"
              >
                {{ featuredDoubletExample.browseCtaLabel }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-5" aria-labelledby="home-source-languages-heading">
      <div class="grid gap-6 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)] lg:items-start">
        <div class="grid gap-6">
          <div>
            <p class="mb-2 font-label text-sm font-bold uppercase tracking-[0.12em] text-text-muted">
              Source languages
            </p>
            <h2 id="home-source-languages-heading" class="text-3xl font-black leading-tight tracking-[-0.04em]">
              {{ featuredAncestorLanguageExample.heading }}
            </h2>
            <p class="mt-4 leading-7 text-text-muted">
              {{ featuredAncestorLanguageExample.concept }}
            </p>
          </div>

          <RouterLink
            :to="{
              name: 'ancestor-language-results',
              params: {
                langCode: featuredAncestorLanguageExample.descendantLangCode,
                ancestorLangCode: featuredAncestorLanguageExample.ancestorLangCode
              }
            }"
            :class="primaryLinkClass"
          >
            {{ featuredAncestorLanguageExample.ctaLabel }}
          </RouterLink>
        </div>

        <div class="rounded-md border border-border bg-surface/75 p-5 shadow-paper">
          <div class="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p class="mb-2 font-label text-xs font-black uppercase tracking-[0.14em] text-text-muted">
                Featured today
              </p>
              <h3 class="text-2xl font-bold leading-tight">
                {{ featuredAncestorLanguageExample.exampleTitle }}
              </h3>
              <p class="mt-3 max-w-2xl leading-7 text-text-muted">
                {{ featuredAncestorLanguageExample.exampleText }}
              </p>
            </div>
            <p class="rounded-full border border-border bg-surface-muted px-3 py-1 font-label text-xs font-black uppercase tracking-[0.12em] text-text-muted">
              {{ featuredAncestorLanguageExample.descendantLanguage }} to {{ featuredAncestorLanguageExample.ancestorLanguage }}
            </p>
          </div>

          <div class="grid gap-3">
            <RouterLink
              v-for="link in featuredAncestorLanguageExample.links"
              :key="link.term"
              :to="{ name: 'etymology', params: { langCode: featuredAncestorLanguageExample.descendantLangCode, term: link.term } }"
              class="grid gap-2 rounded-md border border-border bg-background/55 p-4 text-left transition hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="text-lg font-bold leading-tight text-text">{{ link.term }}</span>
                <span class="font-label text-xs font-black uppercase tracking-[0.12em] text-text-muted">
                  reaches {{ link.ancestor }}
                </span>
              </span>
              <span class="text-sm leading-6 text-text-muted">{{ link.note }}</span>
            </RouterLink>
          </div>

          <RouterLink
            :to="{ name: 'ancestor-language-search' }"
            :class="secondaryLinkClass"
            class="mt-5"
          >
            Choose another language pair
          </RouterLink>
        </div>
      </div>
    </section>
  </main>
</template>
