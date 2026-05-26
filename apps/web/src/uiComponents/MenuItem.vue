<script setup lang="ts">
import { useAttrs, type HTMLAttributes, type VNodeRef } from "vue";

type MenuItemAttrs = HTMLAttributes & {
  key?: string | number | symbol;
  ref?: VNodeRef;
};

defineOptions({
  inheritAttrs: false
});

const itemAttrs = useAttrs() as MenuItemAttrs;

withDefaults(
  defineProps<{
    label: string;
    description?: string;
    selected?: boolean;
    highlighted?: boolean;
  }>(),
  {
    description: undefined,
    selected: false,
    highlighted: false,
  }
);

defineSlots<{
  default(props: { selected: boolean; highlighted: boolean }): unknown;
}>();
</script>

<template>
  <li
    v-bind="itemAttrs"
    class="grid cursor-pointer gap-0.5 rounded-xl px-4 py-3 font-sans text-sm text-text outline-none transition data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-accent-soft data-highlighted:text-text data-[state=checked]:text-accent"
  >
    <slot :selected="selected" :highlighted="highlighted">
      <span class="font-label font-bold">{{ label }}</span>
      <span v-if="description" class="text-xs leading-5 text-text-muted">
        {{ description }}
      </span>
    </slot>
  </li>
</template>
