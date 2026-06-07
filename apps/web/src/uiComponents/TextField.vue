<script setup lang="ts">
import { computed, useId, type InputHTMLAttributes } from "vue";

import Badge from "./Badge.vue";
import TextFieldBase from "./TextFieldBase.vue";

type TextFieldType = "email" | "password" | "search" | "tel" | "text" | "url";
type TextFieldInputAttrs = InputHTMLAttributes & Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    id?: string;
    type?: TextFieldType;
    name?: string;
    placeholder?: string;
    autocomplete?: string;
    helpText?: string;
    error?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    inputAttrs?: TextFieldInputAttrs;
  }>(),
  {
    id: undefined,
    type: "text",
    name: undefined,
    placeholder: undefined,
    autocomplete: undefined,
    helpText: undefined,
    error: undefined,
    disabled: false,
    readonly: false,
    required: false,
    inputAttrs: () => ({})
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const generatedId = useId();
const inputId = computed(resolveInputId);
const helperTextId = computed(resolveHelperTextId);
const describedBy = computed(resolveDescribedBy);

/** Gives unlabeled form controls a stable generated id while allowing explicit ids for forms. */
function resolveInputId(): string {
  return props.id ?? `text-field-${generatedId}`;
}

/** Connects helper or error copy to the input without emitting empty ARIA references. */
function resolveHelperTextId(): string | undefined {
  if (!props.helpText && !props.error) {
    return undefined;
  }

  return `${inputId.value}-description`;
}

/** Prefers error copy as the announced description when validation is active. */
function resolveDescribedBy(): string | undefined {
  return helperTextId.value;
}
</script>

<template>
  <label class="grid min-w-0 gap-2 font-label text-sm font-bold text-text" :for="inputId">
    <span class="flex items-center justify-between gap-3">
      <span>{{ label }}</span>
      <Badge v-if="required">
        Required
      </Badge>
    </span>

    <div class="min-w-0" :class="$slots.inputSuffix ? 'relative' : undefined">
      <TextFieldBase
        :id="inputId"
        :model-value="modelValue"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :aria-invalid="Boolean(error)"
        :aria-describedby="describedBy"
        :input-attrs="inputAttrs"
        :input-class="$slots.inputSuffix ? 'pr-11' : undefined"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <div
        v-if="$slots.inputSuffix"
        class="pointer-events-none absolute inset-y-0 right-3 flex items-center"
      >
        <slot name="inputSuffix" />
      </div>
    </div>

    <span
      v-if="error || helpText"
      :id="helperTextId"
      class="font-sans text-sm font-normal leading-6"
      :class="error ? 'text-danger' : 'text-text-muted'"
    >
      {{ error ?? helpText }}
    </span>
  </label>
</template>
