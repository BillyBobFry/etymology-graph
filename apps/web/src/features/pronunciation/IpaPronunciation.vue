<script setup lang="ts">
import { computed } from "vue";

import Tooltip from "../../uiComponents/Tooltip.vue";
import { describeIpaPronunciation, ipaGuideLabel } from "./ipaPronunciationGuide";

const props = withDefaults(
  defineProps<{
    ipa: string;
    label?: string;
    subtle?: boolean;
  }>(),
  {
    label: undefined,
    subtle: false
  }
);

const guideTokens = computed(() => describeIpaPronunciation(props.ipa));
const triggerLabel = computed(() => ipaGuideLabel(props.label ? `${props.ipa} ${props.label}` : props.ipa));
const displayText = computed(() => (props.label ? `${props.ipa} ${props.label}` : props.ipa));
const triggerClass = computed(() => [
  "inline-flex cursor-help items-baseline rounded-[3px] underline decoration-border-strong decoration-dotted underline-offset-4 transition hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  props.subtle ? "text-inherit" : "text-text-muted"
]);
</script>

<template>
  <Tooltip
    :positioning="{ placement: 'top-start', strategy: 'fixed', gutter: 8, flip: true, shift: 8, overflowPadding: 16 }"
    content-class="max-h-[min(calc(100dvh_-_32px),22rem)] w-[min(360px,calc(100vw_-_32px))] overflow-y-auto overscroll-contain"
    :open-delay="500"
  >
    <template #trigger="{ triggerProps, toggleFromClick }">
      <button
        v-bind="triggerProps"
        type="button"
        :class="triggerClass"
        :aria-label="triggerLabel"
        @click="toggleFromClick"
      >
        {{ displayText }}
      </button>
    </template>

    <template #default="{ titleProps, descriptionProps }">
      <div class="grid gap-3">
        <div>
          <p v-bind="titleProps" class="font-label text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
            Pronunciation guide
          </p>
          <p class="mt-1 text-base font-bold text-text">
            {{ displayText }}
          </p>
        </div>

        <dl v-bind="descriptionProps" class="grid gap-2">
          <div
            v-for="token in guideTokens"
            :key="`${token.symbol}-${token.guide}-${token.details.join(',')}`"
            class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-border pt-2 first:border-t-0 first:pt-0"
          >
            <dt class="font-label text-sm font-black text-text">
              {{ token.symbol }}
            </dt>
            <dd class="text-sm leading-6 text-text-muted">
              {{ token.guide }}
              <span v-if="token.details.length > 0">
                {{ token.details.join(", ") }}.
              </span>
            </dd>
          </div>
        </dl>

        <p class="border-t border-border pt-2 text-xs leading-5 text-text-muted">
          Approximate guide. Sounds vary by language and accent.
        </p>
      </div>
    </template>
  </Tooltip>
</template>
