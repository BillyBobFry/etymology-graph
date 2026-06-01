<script setup lang="ts">
import AncestorLanguageSuggestions from "./AncestorLanguageSuggestions.vue";

type AncestorLanguageSuggestion = {
  ancestorLangCode: string;
  ancestorName: string;
  description: string;
};

defineProps<{
  suggestions: AncestorLanguageSuggestion[];
}>();

const emit = defineEmits<{
  select: [ancestorLangCode: string];
}>();
</script>

<template>
  <div class="grid gap-4 py-2 text-text-page-muted">
    <div class="grid gap-2">
      <h3 class="font-label text-sm font-black uppercase tracking-[0.12em] text-text">
        No imported matches for this pair
      </h3>
      <p class="leading-7">
        No entries in the current import connect these two languages yet. Try another source language below.
      </p>
    </div>
    <AncestorLanguageSuggestions
      v-if="suggestions.length > 0"
      :suggestions="suggestions"
      @select="emit('select', $event)"
    />
  </div>
</template>
