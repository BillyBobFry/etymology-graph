<script setup lang="ts">
import { computed, useId } from "vue";

import Tooltip from "../../uiComponents/Tooltip.vue";
import { linguisticGlossaryTerms, type LinguisticGlossaryTermId } from "./linguisticGlossary";

const props = defineProps<{
  termId: LinguisticGlossaryTermId;
  text?: string;
}>();

const generatedId = useId();
const tooltipId = computed(() => `glossary-tooltip-${props.termId}-${generatedId}`);
const term = computed(() => linguisticGlossaryTerms[props.termId]);
const triggerText = computed(() => props.text ?? term.value.label);
</script>

<template>
  <Tooltip
    :id="tooltipId"
    :positioning="{ placement: 'top', strategy: 'fixed', gutter: 6 }"
  >
    <template #trigger="{ triggerProps, toggleFromClick }">
      <span class="inline">
        <button
          v-bind="triggerProps"
          class="inline cursor-pointer rounded-[3px] border-b border-dotted border-accent/70 bg-accent-soft/25 px-0.5 text-text transition duration-150 hover:bg-accent-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-accent-soft/45"
          @click="toggleFromClick"
        >
          {{ triggerText }}
        </button>
      </span>
    </template>

    <template #default="{ titleProps, descriptionProps }">
      <p v-bind="titleProps" class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
        {{ term.label }}
      </p>
      <p v-bind="descriptionProps" class="mt-1">
        {{ term.shortDefinition }}
      </p>
      <p v-if="term.example" class="mt-2 text-text-muted">
        {{ term.example }}
      </p>
    </template>
  </Tooltip>
</template>
