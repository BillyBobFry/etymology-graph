<script setup lang="ts">
import { computed } from "vue";

import type { GraphNode, SimilarTerm } from "@etymology-graph/graph";

import Button from "../uiComponents/Button.vue";
import Skeleton from "../uiComponents/Skeleton.vue";

const skeletonItems = [0, 1, 2, 3] as const;

const props = withDefaults(
  defineProps<{
    idPrefix: string;
    similarTerms: SimilarTerm[];
    cognates: GraphNode[];
    selectedCognateIds: string[];
    similarTermsLoading: boolean;
    similarTermsError: boolean;
    cognatesLoading: boolean;
    cognatesChecking: boolean;
    cognatesError: boolean;
    cognateExpansionError: string | null;
    compact?: boolean;
  }>(),
  {
    compact: false
  }
);

const emit = defineEmits<{
  "toggle-cognate": [cognate: GraphNode];
}>();

const selectedCognateIdSet = computed(() => new Set(props.selectedCognateIds));
const hasSimilarTermsSection = computed(
  () => props.similarTerms.length > 0 || props.similarTermsLoading || props.similarTermsError
);
const hasCognatesSection = computed(
  () => props.cognates.length > 0 || props.cognatesLoading || props.cognatesChecking || props.cognatesError
);
const similarTermsHeadingId = computed(() => `${props.idPrefix}-similar-terms-heading`);
const cognatesHeadingId = computed(() => `${props.idPrefix}-cognates-heading`);

/** Checks whether a cognate ancestry is already included in the visible graph. */
const isCognateSelected = (cognate: GraphNode): boolean => selectedCognateIdSet.value.has(cognate.id);
</script>

<template>
  <div class="grid" :class="compact ? 'gap-4' : 'gap-5'">
    <section v-if="hasSimilarTermsSection" :aria-labelledby="similarTermsHeadingId">
      <div class="mb-3">
        <h3 :id="similarTermsHeadingId" class="mb-1 font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
          Similar terms
        </h3>
      </div>
      <div
        v-if="similarTermsLoading"
        class="flex flex-nowrap gap-2 overflow-hidden"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">Finding nearby entries</span>
        <span
          v-for="item in skeletonItems"
          :key="item"
          class="min-w-0 h-[34px] w-[72px] shrink-0 rounded-md"
          aria-hidden="true"
        >
          <Skeleton class="h-full" tone="raised" />
        </span>
      </div>
      <p v-else-if="similarTermsError" class="text-sm leading-6 text-text-muted">
        Similar terms are unavailable right now.
      </p>
      <div v-else class="flex flex-wrap gap-2">
        <Button
          v-for="similarTerm in similarTerms"
          :key="similarTerm.node.id"
          variant="secondary"
          size="sm"
          :to="{
            name: 'etymology',
            params: {
              langCode: similarTerm.node.langCode,
              term: similarTerm.node.word
            }
          }"
        >
          {{ similarTerm.node.word }}
        </Button>
      </div>
    </section>

    <section v-if="hasCognatesSection" :aria-labelledby="cognatesHeadingId">
      <div class="mb-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 :id="cognatesHeadingId" class="mb-1 font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Cognates
            </h3>
            <p class="text-sm leading-6 text-text-muted">
              Explicitly linked relatives in other languages.
            </p>
          </div>
        </div>
      </div>
      <div
        v-if="cognatesLoading || cognatesChecking"
        class="flex flex-nowrap gap-2 overflow-hidden"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">Finding connected cognates</span>
        <span
          v-for="item in skeletonItems"
          :key="item"
          class="min-w-0 h-[44px] w-[104px] shrink-0 rounded-md"
          aria-hidden="true"
        >
          <Skeleton class="h-full" tone="raised" />
        </span>
      </div>
      <p v-else-if="cognatesError" class="text-sm leading-6 text-text-muted">
        Cognates are unavailable right now.
      </p>
      <div v-else class="flex flex-wrap gap-2">
        <Button
          v-for="cognate in cognates"
          :key="cognate.id"
          :variant="isCognateSelected(cognate) ? 'primary' : 'secondary'"
          size="sm"
          :aria-pressed="isCognateSelected(cognate)"
          @click="emit('toggle-cognate', cognate)"
        >
          <span class="inline-flex items-baseline gap-2 text-left">
            <span class="font-bold">{{ cognate.word }}</span>
            <span
              class="font-sans text-xs font-normal leading-none"
              :class="isCognateSelected(cognate) ? 'text-accent-contrast/85' : 'text-text-muted'"
            >
              {{ cognate.langName ?? cognate.langCode }}
            </span>
          </span>
        </Button>
      </div>
      <p v-if="cognateExpansionError" class="mt-3 text-sm leading-6 text-danger">
        {{ cognateExpansionError }}
      </p>
    </section>
  </div>
</template>
