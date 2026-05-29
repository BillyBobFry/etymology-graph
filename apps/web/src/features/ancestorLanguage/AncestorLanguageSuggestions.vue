<script setup lang="ts">
import Button from "../../uiComponents/Button.vue";

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
  <div class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
    <Button
      v-for="suggestion in suggestions"
      :key="suggestion.ancestorLangCode"
      class="grid! h-full grid-rows-[minmax(1rem,auto)_1fr] items-start! justify-stretch! gap-1 text-left [&>span]:contents"
      variant="secondary"
      full-width
      @click="emit('select', suggestion.ancestorLangCode)"
    >
      <span class="contents">
        <span>{{ suggestion.ancestorName }}</span>
        <span class="font-sans text-sm font-normal leading-5 text-text-muted">{{ suggestion.description }}</span>
      </span>
    </Button>
  </div>
</template>
