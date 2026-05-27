<script setup lang="ts">
import * as combobox from "@zag-js/combobox";
import { normalizeProps, useMachine, type PropTypes } from "@zag-js/vue";
import { computed, ref, useId, watch } from "vue";
import MenuItem from "./MenuItem.vue";
import TextField from "./TextField.vue";


interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    inputValue?: string;
    options: ComboboxOption[];
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
    emptyText?: string;
    filterOptions?: boolean;
    openOnClick?: boolean;
    allowCustomValue?: boolean;
    closeOnEmpty?: boolean;
    positioning?: combobox.Props['positioning'];
  }>(),
  {
    modelValue: undefined,
    inputValue: undefined,
    id: undefined,
    name: undefined,
    placeholder: undefined,
    autocomplete: "off",
    helpText: undefined,
    error: undefined,
    disabled: false,
    readonly: false,
    required: false,
    emptyText: "No matching terms",
    filterOptions: true,
    openOnClick: true,
    allowCustomValue: false,
    closeOnEmpty: false,
    positioning: () => ({
      placement: "bottom-start",
      strategy: "fixed",
      sameWidth: true,
      gutter: 4
    })
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
  "update:inputValue": [value: string];
  select: [option: ComboboxOption | null];
}>();

defineSlots<{
  option?: (props: { option: ComboboxOption; selected: boolean; highlighted: boolean }) => unknown;
  empty?: () => unknown;
}>();

const generatedId = useId();
const inputId = computed(() => props.id ?? `combobox-${generatedId}`);
const internalInputValue = ref(resolveInitialInputValue());
const inputValue = computed(() => props.inputValue ?? internalInputValue.value);
const resolvedHelpText = computed(() => props.helpText ?? undefined);
const filteredOptions = computed(filterOptions);
const optionCollection = computed(() => (combobox.collection<ComboboxOption>({
    items: filteredOptions.value,
    itemToValue: (option) => option.value,
    itemToString: (option) => option.label,
    isItemDisabled: (option) => Boolean(option.disabled)
  })));
const service = useMachine(combobox.machine, computed(() => ({
    id: inputId.value,
    ids: {
      input: inputId.value
    },
    name: props.name,
    placeholder: props.placeholder,
    disabled: props.disabled,
    readOnly: props.readonly,
    required: props.required,
    invalid: Boolean(props.error),
    collection: optionCollection.value,
    value: props.modelValue === undefined ? [] : [props.modelValue],
    inputValue: inputValue.value,
    openOnClick: props.openOnClick,
    allowCustomValue: props.allowCustomValue,
    inputBehavior: "autohighlight" as const,
    selectionBehavior: "replace" as const,
    positioning: props.positioning,
    onInputValueChange: handleInputValueChange,
    onValueChange: handleValueChange
  })));

const api = computed(() => combobox.connect<PropTypes, ComboboxOption>(service, normalizeProps));
const inputAttrs = computed(() => ({
    ...api.value.getInputProps(),
    autocomplete: props.autocomplete
  }));
const visibleOptions = computed(() => api.value.collection.items);

watch(() => props.modelValue, syncInputToSelectedValue);
watch(() => props.options, syncInputToSelectedValue);

/** Uses the selected option label as the initial typed value when possible. */
function resolveInitialInputValue(): string {
  return findOptionByValue(props.modelValue)?.label ?? "";
}

/** Keeps the visible input aligned when the selected value changes from outside. */
function syncInputToSelectedValue(): void {
  if (props.inputValue !== undefined) {
    return;
  }

  internalInputValue.value = resolveInitialInputValue();
}

/** Finds the option object that represents a selected serialized value. */
function findOptionByValue(value: string | undefined): ComboboxOption | undefined {
  if (value === undefined) {
    return undefined;
  }

  return props.options.find((option) => option.value === value);
}

/** Narrows the list to useful matches while letting callers opt into server-filtered lists. */
function filterOptions(): ComboboxOption[] {
  if (!props.filterOptions) {
    return [...props.options];
  }

  const query = inputValue.value.trim().toLocaleLowerCase();

  if (!query) {
    return [...props.options];
  }

  return props.options.filter((option) => {
    const label = option.label.toLocaleLowerCase();
    const value = option.value.toLocaleLowerCase();
    const description = option.description?.toLocaleLowerCase() ?? "";

    return label.includes(query) || value.includes(query) || description.includes(query);
  });
}


/** Updates local and parent typing state when Zag processes keyboard input. */
function handleInputValueChange(details: combobox.InputValueChangeDetails): void {
  if (props.inputValue === undefined) {
    internalInputValue.value = details.inputValue;
  }

  emit("update:inputValue", details.inputValue);
}

/** Emits the selected option through the component's selected-value model. */
function handleValueChange(details: combobox.ValueChangeDetails<ComboboxOption>): void {
  const selectedOption = details.items[0] ?? null;
  const selectedValue = selectedOption?.value ?? details.value[0];

  if (props.inputValue === undefined) {
    internalInputValue.value = selectedOption?.label ?? "";
  }

  emit("update:modelValue", selectedValue);
  emit("select", selectedOption);
}

watch(() => props.closeOnEmpty && !inputValue.value.trim(), (shouldClose) => {
  if (shouldClose && api.value.open) {
    api.value.setOpen(false);
  }
});

</script>

<template>
  <div v-bind="api.getRootProps()" class="relative">
    <div v-bind="api.getControlProps()">
      <TextField
        :id="inputId"
        :model-value="api.inputValue"
        :label="label"
        type="search"
        :name="name"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :help-text="resolvedHelpText"
        :error="error"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :input-attrs="inputAttrs"
      />
    </div>

    <Teleport to="body">
      <div v-if="api.open" v-bind="api.getPositionerProps()" class="z-1000" style="z-index: 1000">
        <div
          v-bind="api.getContentProps()"
          class="overflow-hidden rounded-2xl border border-border-strong bg-surface-raised shadow-overlay"
        >
          <ul v-bind="api.getListProps()" class="max-h-72 overflow-y-auto p-1 overscroll-contain">
            <li
              v-if="visibleOptions.length === 0"
              class="px-4 py-3 font-sans text-sm text-text-muted"
            >
              <slot name="empty">{{ emptyText }}</slot>
            </li>

            <MenuItem
              v-for="option in visibleOptions"
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
