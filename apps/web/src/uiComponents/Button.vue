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
    class="inline-flex items-center justify-center gap-2 rounded-xs border font-label font-medium leading-none transition duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    :class="[
      variant === 'primary' && 'border-accent bg-accent text-accent-contrast shadow-paper hover:brightness-95',
      variant === 'secondary' && 'border-border-strong bg-surface-muted text-text hover:border-border-strong hover:brightness-95',
      variant === 'ghost' && 'border-transparent bg-transparent text-text-muted hover:bg-background hover:text-text hover:brightness-95',
      variant === 'danger' && 'border-danger bg-danger text-accent-contrast shadow-paper hover:brightness-95',
      (variant !== 'ghost' || active) && 'button-paper',
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
      class="relative z-10 size-4 rounded-full border-2 border-current border-r-transparent opacity-80 motion-safe:animate-spin"
      aria-hidden="true"
    />
    <span class="relative z-10">
      <slot>{{ loading ? loadingLabel : "" }}</slot>
    </span>
  </component>
</template>

<style scoped>
.button-paper {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background-image:
    linear-gradient(
      180deg,
      color-mix(in oklch, white 18%, transparent),
      transparent 44%,
      color-mix(in oklch, black 5%, transparent)
    ),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='fiber'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.38 0 0 0 0 0.3 0 0 0 0 0.18 0 0 0 0.18 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23fiber)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light, multiply;
  background-size:
    100% 100%,
    120px 120px;
}

.dark .button-paper {
  background-image:
    linear-gradient(
      180deg,
      color-mix(in oklch, white 10%, transparent),
      transparent 48%,
      color-mix(in oklch, black 12%, transparent)
    ),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='fiber'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.86 0 0 0 0 0.76 0 0 0 0 0.58 0 0 0 0.13 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23fiber)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light, screen;
}
</style>
