<script setup lang="ts">
import * as tooltip from "@zag-js/tooltip";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import type { ButtonHTMLAttributes } from "vue";
import { computed, useId } from "vue";

import { linguisticGlossaryTerms, type LinguisticGlossaryTermId } from "./linguisticGlossary";

const props = defineProps<{
  termId: LinguisticGlossaryTermId;
  text?: string;
}>();

type TriggerButtonProps = Omit<ButtonHTMLAttributes, "type"> & {
  type: "button";
};

const generatedId = useId();
const tooltipId = computed(() => `glossary-tooltip-${props.termId}-${generatedId}`);
const term = computed(() => linguisticGlossaryTerms[props.termId]);
const triggerText = computed(() => props.text ?? term.value.label);

const service = useMachine(
  tooltip.machine,
  computed(() => ({
    id: tooltipId.value,
    closeDelay: 120,
    openDelay: 180,
    positioning: {
      placement: "top",
      strategy: "fixed",
      gutter: 6
    }
  }))
);

const api = computed(() => tooltip.connect<PropTypes>(service, normalizeProps));
const triggerProps = computed<TriggerButtonProps>(() => ({
  ...api.value.getTriggerProps(),
  type: "button"
}));
</script>

<template>
  <span class="inline">
    <button
      v-bind="triggerProps"
      class="inline rounded-[3px] border-b border-dotted border-accent/70 bg-accent-soft/25 px-0.5 text-text transition duration-150 hover:bg-accent-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {{ triggerText }}
    </button>
  </span>

  <Teleport to="body">
    <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
      <div
        v-bind="api.getContentProps()"
        class="max-w-xs rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm leading-6 text-text shadow-overlay"
      >
        <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
          {{ term.label }}
        </p>
        <p class="mt-1">
          {{ term.shortDefinition }}
        </p>
        <p v-if="term.example" class="mt-2 text-text-muted">
          {{ term.example }}
        </p>
      </div>
    </div>
  </Teleport>
</template>
