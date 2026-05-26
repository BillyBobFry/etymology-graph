<script setup lang="ts">
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type ButtonType = "button" | "submit" | "reset";

withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: ButtonType;
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

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border font-label font-bold leading-none transition duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-65";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-accent-contrast shadow-paper hover:brightness-105",
  secondary:
    "border-border-strong bg-surface-muted text-text hover:border-accent hover:bg-surface-raised hover:text-accent",
  ghost:
    "border-transparent bg-transparent text-text-muted hover:bg-accent-soft/55 hover:text-text",
  danger:
    "border-danger bg-danger text-accent-contrast shadow-paper hover:brightness-105"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-4 text-lg"
};

const activeClass = "bg-surface-muted text-text";
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :class="[
      baseClass,
      variantClasses[variant],
      sizeClasses[size],
      active ? activeClass : '',
      fullWidth ? 'w-full' : 'w-fit'
    ]"
  >
    <span
      v-if="loading"
      class="size-4 rounded-full border-2 border-current border-r-transparent opacity-80 motion-safe:animate-spin"
      aria-hidden="true"
    />
    <span>
      <slot>{{ loading ? loadingLabel : "" }}</slot>
    </span>
  </button>
</template>
