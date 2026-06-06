<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type ButtonType = "button" | "submit" | "reset";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: ButtonType;
    to?: RouteLocationRaw;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    active?: boolean;
    loadingLabel?: string;
  }>(),
  {
    variant: "primary",
    size: "md",
    type: "button",
    disabled: false,
    loading: false,
    fullWidth: false,
    active: false,
    loadingLabel: "Working..."
  }
);

const isLink = computed(() => props.to !== undefined);
const buttonComponent = computed(() => (isLink.value ? RouterLink : "button"));

/** Keeps link-shaped buttons from navigating while they are inactive. */
const preventInactiveLinkClick = (event: MouseEvent): void => {
  if (!isLink.value || (!props.disabled && !props.loading)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
};
</script>

<template>
  <component
    :is="buttonComponent"
  :to="to"
    :type="isLink ? undefined : type"
    :disabled="isLink ? undefined : disabled || loading"
    :aria-busy="loading"
    :aria-disabled="isLink && (disabled || loading) ? 'true' : undefined"
    :tabindex="isLink && (disabled || loading) ? -1 : undefined"
    class="inline-flex items-center justify-center gap-2 rounded-md border font-label font-medium leading-none transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    :class="[
      variant === 'primary' && 'border-accent bg-accent text-accent-contrast shadow-paper hover:brightness-95',
      variant === 'secondary' && 'border-border-strong bg-surface-muted text-text hover:border-border-strong hover:brightness-95',
      variant === 'ghost' && 'border-transparent bg-transparent text-text-muted hover:bg-background hover:text-text hover:brightness-95',
      variant === 'danger' && 'border-danger bg-danger text-accent-contrast shadow-paper hover:brightness-95',
      size === 'sm' && 'px-3 py-2 text-sm',
      size === 'md' && 'px-5 py-3 text-base',
      size === 'lg' && 'px-6 py-4 text-lg',
      disabled || loading ? 'cursor-not-allowed opacity-65' : 'cursor-pointer',
      active && 'bg-surface-muted text-text',
      fullWidth ? 'w-full' : 'w-fit',
    ]"
    @click="preventInactiveLinkClick"
  >
    <span
      v-if="loading"
      class="size-4 rounded-full border-2 border-current border-r-transparent opacity-80 motion-safe:animate-spin"
      aria-hidden="true"
    />
    <span>
      <slot>{{ loading ? loadingLabel : "" }}</slot>
    </span>
  </component>
</template>
