<script setup lang="ts">
import * as popover from "@zag-js/popover";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import type { ButtonHTMLAttributes, HTMLAttributes } from "vue";
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    defaultOpen?: boolean;
    id?: string;
    positioning?: popover.Props["positioning"];
    portalled?: boolean;
    autoFocus?: boolean;
    modal?: boolean;
    closeOnEscape?: boolean;
    closeOnInteractOutside?: boolean;
  }>(),
  {
    open: undefined,
    defaultOpen: false,
    id: undefined,
    positioning: () => ({
      placement: "bottom-end",
      strategy: "fixed",
      gutter: 8
    }),
    portalled: true,
    autoFocus: false,
    modal: false,
    closeOnEscape: true,
    closeOnInteractOutside: true
  }
);

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

type TriggerButtonProps = Omit<ButtonHTMLAttributes, "disabled" | "type"> & {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};


const generatedId = useId();
const popoverId = computed(() => props.id ?? `popover-${generatedId}`);
const service = useMachine(
  popover.machine,
  computed(() => ({
    id: popoverId.value,
    open: props.open,
    defaultOpen: props.defaultOpen,
    positioning: props.positioning,
    portalled: props.portalled,
    autoFocus: props.autoFocus,
    modal: props.modal,
    closeOnEscape: props.closeOnEscape,
    closeOnInteractOutside: props.closeOnInteractOutside,
    onOpenChange: handleOpenChange
  }))
);

const api = computed(() => popover.connect<PropTypes>(service, normalizeProps));
const triggerProps = computed<TriggerButtonProps>(() => {
  const props = api.value.getTriggerProps();
  const disabled = props.disabled;
  const type = props.type === "submit" || props.type === "reset" ? props.type : "button";

  return {
    ...props,
    disabled: disabled === true || disabled === "true",
    type
  };
});

/** Mirrors Zag's popover state through v-model so callers can reset auxiliary UI. */
function handleOpenChange(details: popover.OpenChangeDetails): void {
  emit("update:open", details.open);
}
</script>

<template>
  <slot name="trigger" :trigger-props="triggerProps" :is-open="api.open" />

  <Teleport to="body" :disabled="!api.portalled">
    <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
      <div
        v-bind="api.getContentProps()"
        class="min-w-64 max-w-[calc(100vw-32px)] rounded-md border border-border-strong bg-surface-raised p-3 shadow-paper outline-none"
      >
        <slot
          :content-props="api.getContentProps()"
          :title-props="api.getTitleProps()"
          :description-props="api.getDescriptionProps()"
          :close-trigger-props="api.getCloseTriggerProps()"
          :open="api.open"
          :api="api"
        />
      </div>
    </div>
  </Teleport>
</template>
