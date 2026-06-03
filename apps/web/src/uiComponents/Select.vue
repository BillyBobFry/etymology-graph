<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import * as select from "@zag-js/select";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, useId } from "vue";

import Badge from "./Badge.vue";
import MenuItem from "./MenuItem.vue";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

const defaultListMaxHeight = 288;

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: SelectOption[];
    label: string;
    id?: string;
    name?: string;
    placeholder?: string;
    autocomplete?: string;
    helpText?: string | null;
    error?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    constantTriggerWidth?: boolean;
    emptyText?: string;
    listMaxHeight?: number;
    positioning?: select.Props["positioning"];
  }>(),
  {
    modelValue: undefined,
    id: undefined,
    name: undefined,
    placeholder: "Choose an option",
    autocomplete: "off",
    helpText: undefined,
    error: undefined,
    disabled: false,
    readonly: false,
    required: false,
    constantTriggerWidth: false,
    emptyText: "No options available",
    listMaxHeight: defaultListMaxHeight,
    positioning: () => ({
      placement: "bottom-start",
      strategy: "fixed",
      sameWidth: false,
      gutter: 4
    })
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  select: [option: SelectOption | null];
}>();

defineSlots<{
  value?: (props: { option: SelectOption }) => unknown;
  option?: (props: { option: SelectOption; selected: boolean; highlighted: boolean }) => unknown;
  empty?: () => unknown;
}>();

const generatedId = useId();
const triggerId = computed(() => props.id ?? `select-${generatedId}`);
const labelId = computed(() => `${triggerId.value}-label`);
const helperTextId = computed(() => {
  if (!props.helpText && !props.error) {
    return undefined;
  }

  return `${triggerId.value}-description`;
});
const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue)
);
const longestOptionLabel = computed(() =>
  props.options.reduce((longestLabel, option) =>
    option.label.length > longestLabel.length ? option.label : longestLabel,
  ""
  )
);
const optionCollection = computed(() => select.collection<SelectOption>({
  items: props.options,
  itemToValue: (option) => option.value,
  itemToString: (option) => option.label,
  isItemDisabled: (option) => Boolean(option.disabled)
}));
const service = useMachine(select.machine, computed(() => ({
  id: triggerId.value,
  ids: {
    label: labelId.value,
    trigger: triggerId.value
  },
  name: props.name,
  autoComplete: props.autocomplete,
  disabled: props.disabled,
  readOnly: props.readonly,
  required: props.required,
  invalid: Boolean(props.error),
  collection: optionCollection.value,
  value: props.modelValue === undefined ? [] : [props.modelValue],
  positioning: props.positioning,
  onValueChange: handleValueChange
})));

const api = computed(() => select.connect<PropTypes, SelectOption>(service, normalizeProps));
const triggerProps = computed(() => ({
  ...api.value.getTriggerProps(),
  "aria-describedby": helperTextId.value
}));
const listboxStyle = computed(() => ({
  maxHeight: `${props.listMaxHeight}px`
}));

/** Emits the selected option through the component's selected-value model. */
function handleValueChange(details: select.ValueChangeDetails<SelectOption>): void {
  const nextOption = details.items[0] ?? null;
  const nextValue = nextOption?.value ?? details.value[0];

  emit("update:modelValue", nextValue);
  emit("select", nextOption);
}
</script>

<template>
  <div v-bind="api.getRootProps()" class="relative grid gap-2">
    <select v-bind="api.getHiddenSelectProps()">
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <span
      v-bind="api.getLabelProps()"
      class="flex items-center justify-between gap-3 font-label text-sm font-bold text-text"
    >
      <span>{{ label }}</span>
      <Badge v-if="required">
        Required
      </Badge>
    </span>

    <div v-bind="api.getControlProps()">
      <button
        v-bind="triggerProps"
        type="button"
          :class="[
            'cursor-pointer rounded-md border border-border-strong bg-surface-raised px-4 py-3 font-sans text-base font-normal text-text outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:opacity-75 data-placeholder:text-text-muted/70 data-readonly:bg-surface-muted',
            constantTriggerWidth
              ? 'inline-grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3'
              : 'flex min-w-0 items-center justify-between gap-3'
          ]"
      >
        <span v-bind="api.getValueTextProps()" class="relative min-w-0 text-left">
          <span v-if="constantTriggerWidth" class="invisible block whitespace-nowrap pr-1" aria-hidden="true">
            {{ longestOptionLabel }}
          </span>
          <span
            :class="constantTriggerWidth
              ? 'absolute inset-0 block truncate pr-1'
              : 'block truncate'"
          >
            <slot v-if="selectedOption" name="value" :option="selectedOption">
              {{ selectedOption.label }}
            </slot>
            <span v-else class="text-text-muted/70">{{ placeholder }}</span>
          </span>
        </span>
        <span
          v-bind="api.getIndicatorProps()"
          class="shrink-0 text-text-muted transition-transform data-[state=open]:rotate-180"
          aria-hidden="true"
        >
          <ChevronDown :size="18" stroke-width="2.5" />
        </span>
      </button>
    </div>

    <span
      v-if="error || helpText"
      :id="helperTextId"
      class="font-sans text-sm font-normal leading-6"
      :class="error ? 'text-danger' : 'text-text-muted'"
    >
      {{ error ?? helpText }}
    </span>

    <Teleport to="body">
      <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
        <div
          v-bind="api.getContentProps()"
          class="w-max min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-strong bg-surface-raised shadow-overlay"
        >
          <ul
            v-bind="api.getListProps()"
            class="overflow-y-auto p-1 overscroll-contain"
            :style="listboxStyle"
          >
            <li
              v-if="api.collection.items.length === 0"
              class="px-4 py-3 font-sans text-sm text-text-muted"
            >
              <slot name="empty">{{ emptyText }}</slot>
            </li>

            <MenuItem
              v-for="option in api.collection.items"
              :key="option.value"
              :label="option.label"
              :description="option.description"
              :selected="api.getItemState({ item: option }).selected"
              :highlighted="api.getItemState({ item: option }).highlighted"
              v-bind="api.getItemProps({ item: option })"
            >
              <template v-if="$slots.option" #default="{ selected, highlighted }">
                <slot
                  name="option"
                  :option="option"
                  :selected="selected"
                  :highlighted="highlighted"
                />
              </template>
            </MenuItem>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
