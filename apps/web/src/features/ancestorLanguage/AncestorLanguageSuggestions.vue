<script setup lang="ts">
import Button from "../../uiComponents/Button.vue";

import type { ResolvedAncestorLanguageSuggestion } from "./ancestorLanguageSuggestions";

type AncestorLanguageSuggestion = {
  ancestorLangCode: ResolvedAncestorLanguageSuggestion["ancestorLangCode"];
  ancestorName: ResolvedAncestorLanguageSuggestion["ancestorName"];
  description: ResolvedAncestorLanguageSuggestion["description"];
  status?: ResolvedAncestorLanguageSuggestion["status"];
  matchCount?: ResolvedAncestorLanguageSuggestion["matchCount"];
};

defineProps<{
  suggestions: AncestorLanguageSuggestion[];
  activeAncestorLangCode?: string;
}>();

const emit = defineEmits<{
  select: [ancestorLangCode: string];
}>();

/** Prevents unbuilt or empty source layers from starting slow fallback searches. */
function isSuggestionDisabled(suggestion: AncestorLanguageSuggestion): boolean {
  return suggestion.status !== undefined && suggestion.status !== "available";
}

/** Formats layer coverage for compact card metadata. */
function coverageLabel(suggestion: AncestorLanguageSuggestion): string | undefined {
  if (suggestion.status === "unrefreshed") {
    return "Index pending";
  }

  if (suggestion.status === "empty") {
    return "No paths in the index yet";
  }

  if (suggestion.matchCount !== undefined) {
    const countLabel = new Intl.NumberFormat().format(suggestion.matchCount);
    const noun = suggestion.matchCount === 1 ? "match" : "matches";

    return `${countLabel} ${noun}`;
  }

  return undefined;
}
</script>

<template>
  <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
    <Button
      v-for="suggestion in suggestions"
      :key="suggestion.ancestorLangCode"
      class="grid! h-full grid-rows-[minmax(1rem,auto)_1fr] items-start! justify-stretch! gap-1 text-left [&>span]:contents"
      variant="secondary"
      full-width
      :disabled="isSuggestionDisabled(suggestion)"
      :active="suggestion.ancestorLangCode === activeAncestorLangCode"
      :aria-pressed="suggestion.ancestorLangCode === activeAncestorLangCode"
      @click="emit('select', suggestion.ancestorLangCode)"
    >
      <span class="contents">
        <span>{{ suggestion.ancestorName }}</span>
        <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ suggestion.description }}</span>
        <span
          v-if="coverageLabel(suggestion)"
          class="font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted"
        >
          {{ coverageLabel(suggestion) }}
        </span>
      </span>
    </Button>
  </div>
</template>
