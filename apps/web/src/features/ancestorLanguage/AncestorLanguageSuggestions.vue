<script setup lang="ts">
import Badge from "../../uiComponents/Badge.vue";
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

/** Formats layer coverage for compact inline status metadata. */
function coverageBadgeLabel(suggestion: AncestorLanguageSuggestion): string | undefined {
  if (suggestion.status === "unrefreshed") {
    return "Pending";
  }

  if (suggestion.status === "empty") {
    return "No paths";
  }

  if (suggestion.matchCount !== undefined) {
    return new Intl.NumberFormat().format(suggestion.matchCount);
  }

  return undefined;
}

/** Keeps number-only coverage badges clear to assistive tech and hover users. */
function coverageBadgeAccessibleLabel(suggestion: AncestorLanguageSuggestion): string | undefined {
  if (suggestion.matchCount === undefined) {
    return coverageBadgeLabel(suggestion);
  }

  const countLabel = new Intl.NumberFormat().format(suggestion.matchCount);
  const noun = suggestion.matchCount === 1 ? "match" : "matches";

  return `${countLabel} ${noun}`;
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
        <span class="flex items-center justify-between gap-2">
          <span>{{ suggestion.ancestorName }}</span>
          <Badge
            v-if="coverageBadgeLabel(suggestion)"
            class="mt-0.5 shrink-0"
            :aria-label="coverageBadgeAccessibleLabel(suggestion)"
            :title="coverageBadgeAccessibleLabel(suggestion)"
          >
            {{ coverageBadgeLabel(suggestion) }}
          </Badge>
        </span>
        <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ suggestion.description }}</span>
      </span>
    </Button>
  </div>
</template>
