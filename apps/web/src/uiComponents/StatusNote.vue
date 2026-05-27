<script setup lang="ts">
import { X } from "@lucide/vue";

import IconButton from "./IconButton.vue";

type StatusNoteVariant = "neutral" | "danger";

withDefaults(
  defineProps<{
    variant?: StatusNoteVariant;
    dismissible?: boolean;
    dismissLabel?: string;
  }>(),
  {
    variant: "neutral",
    dismissible: false,
    dismissLabel: "Dismiss status"
  }
);

defineEmits<{
  dismiss: [];
}>();

const baseClass =
  "pointer-events-auto flex items-start gap-3 rounded-md border bg-surface-raised/95 px-4 py-3 text-sm leading-6 shadow-panel backdrop-blur";

const variantClasses: Record<StatusNoteVariant, string> = {
  neutral: "border-border text-text-muted",
  danger: "border-danger text-danger"
};
</script>

<template>
  <div :class="[baseClass, variantClasses[variant]]" :role="variant === 'danger' ? 'alert' : 'status'">
    <div class="min-w-0 flex-1">
      <slot />
    </div>
    <IconButton v-if="dismissible" :label="dismissLabel" size="xs" @click="$emit('dismiss')">
      <X :size="14" stroke-width="2.75" aria-hidden="true" />
    </IconButton>
  </div>
</template>
