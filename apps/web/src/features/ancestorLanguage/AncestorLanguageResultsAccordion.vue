<script setup lang="ts">
import { computed } from "vue";

import type { TermsWithAncestorLanguageMatch } from "@etymology-graph/graph";

import Badge from "../../uiComponents/Badge.vue";
import ResultsAccordion from "../../uiComponents/ResultsAccordion.vue";
import { partOfSpeechLabel } from "../terms/utils/partOfSpeech";

const props = defineProps<{
  matches: TermsWithAncestorLanguageMatch[];
  modelValue?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  "prefetch-match": [match: TermsWithAncestorLanguageMatch];
}>();

defineSlots<{
  panel?: (props: { match: TermsWithAncestorLanguageMatch }) => unknown;
}>();

const matchIds = computed(() => props.matches.map((match) => match.entry.id));
const matchesById = computed(() => new Map(props.matches.map((match) => [match.entry.id, match])));

/** Finds a typed match for the id-only shared accordion slot. */
function matchForId(matchId: string): TermsWithAncestorLanguageMatch | undefined {
  return matchesById.value.get(matchId);
}

/** Emits typed prefetch intent after resolving the shared accordion item id. */
function prefetchMatch(matchId: string): void {
  const match = matchForId(matchId);

  if (match) {
    emit("prefetch-match", match);
  }
}

/** Resolves imported language names for the compact source and result labels. */
function languageLabel(term: { langCode: string; langName?: string }): string {
  return term.langName ?? term.langCode;
}

/** Gives each row a short gloss line without requiring the user to expand it. */
function matchDescription(match: TermsWithAncestorLanguageMatch): string {
  return match.entry.primaryGloss ?? "";
}

/** Formats optional part-of-speech metadata for row badges. */
function matchPartOfSpeechLabel(match: TermsWithAncestorLanguageMatch): string | undefined {
  return match.entry.pos === undefined ? undefined : partOfSpeechLabel(match.entry.pos);
}

/** Keeps the traversal length badge grammatically compact. */
function edgeCountLabel(match: TermsWithAncestorLanguageMatch): string {
  return `${match.pathEdgeIds.length} ${
    match.pathEdgeIds.length === 1 ? "step" : "steps"
  }`;
}
</script>

<template>
  <ResultsAccordion
    :item-ids="matchIds"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @prefetch-item="prefetchMatch"
  >
    <template #trigger="{ itemId }">
      <span v-if="matchForId(itemId)" class="grid min-w-0 gap-2">
        <span class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span class="grid min-w-0 gap-0.5">
              <span class="font-label text-[0.68rem] font-bold uppercase tracking-[0.12em] text-text-muted">
                {{ languageLabel(matchForId(itemId)!.node) }}
              </span>
              <span class="truncate font-label text-sm font-black uppercase tracking-[0.12em] text-accent">
                {{ matchForId(itemId)!.node.word }}
              </span>
            </span>
            <span class="font-label text-sm font-bold text-text-muted" aria-hidden="true">
              ←
            </span>
            <span class="grid min-w-0 gap-0.5">
              <span class="font-label text-[0.68rem] font-bold uppercase tracking-[0.12em] text-text-muted">
                {{ languageLabel(matchForId(itemId)!.matchedAncestor) }}
              </span>
              <span class="truncate font-label text-sm font-black uppercase tracking-[0.12em] text-text">
                {{ matchForId(itemId)!.matchedAncestor.word }}
              </span>
            </span>
          </span>
          <span class="flex shrink-0 items-center gap-2 tabular-nums">
            <Badge v-if="matchPartOfSpeechLabel(matchForId(itemId)!) !== undefined">
              {{ matchPartOfSpeechLabel(matchForId(itemId)!) }}
            </Badge>
            <Badge>{{ edgeCountLabel(matchForId(itemId)!) }}</Badge>
          </span>
        </span>
        <span v-if="matchDescription(matchForId(itemId)!).length > 0" class="text-sm leading-6 text-text-muted">
          {{ matchDescription(matchForId(itemId)!) }}
        </span>
      </span>
    </template>

    <template #panel="{ itemId }">
      <slot v-if="matchForId(itemId)" name="panel" :match="matchForId(itemId)!" />
    </template>
  </ResultsAccordion>
</template>
