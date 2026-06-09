<script setup lang="ts">
import * as tooltip from "@zag-js/tooltip";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import type { ButtonHTMLAttributes } from "vue";
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    id?: string;
    positioning?: tooltip.Props["positioning"];
    contentClass?: string;
    openDelay?: number;
    closeDelay?: number;
  }>(),
  {
    id: undefined,
    positioning: () => ({
      placement: "top",
      strategy: "fixed",
      gutter: 6
    }),
    contentClass: "",
    openDelay: 180,
    closeDelay: 120,
  }
);

type TriggerButtonProps = Omit<ButtonHTMLAttributes, "type"> & {
  type: "button";
};

const generatedId = useId();
const tooltipId = computed(() => props.id ?? `tooltip-${generatedId}`);
const service = useMachine(
  tooltip.machine,
  computed(() => ({
    id: tooltipId.value,
    interactive: true,
    closeOnClick: false,
    closeOnPointerDown: false,
    closeOnScroll: false,
    closeDelay: props.closeDelay,
    openDelay: props.openDelay,
    positioning: props.positioning
  }))
) as unknown as tooltip.Service;
const api = computed(() => tooltip.connect<PropTypes>(service, normalizeProps));
const triggerProps = computed<TriggerButtonProps>(() => ({
  ...api.value.getTriggerProps(),
  type: "button"
}));
const contentClass = computed(() => [
  "max-w-[calc(100vw-48px)] rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm leading-6 text-text shadow-overlay sm:max-w-xs",
  props.contentClass
]);
const emptyElementProps = {};

/** Adds tap support without replacing the tooltip's desktop hover behavior. */
function toggleFromClick(): void {
  api.value.setOpen(!api.value.open);
}
</script>

<template>
  <slot
    name="trigger"
    :trigger-props="triggerProps"
    :is-open="api.open"
    :toggle-from-click="toggleFromClick"
  />

  <Teleport to="body">
    <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
      <div v-bind="api.getContentProps()" :class="contentClass">
        <slot
          :title-props="emptyElementProps"
          :description-props="emptyElementProps"
          :open="api.open"
          :api="api"
        />
      </div>
    </div>
  </Teleport>
</template>
