<script setup lang="ts">
type IconButtonVariant = "ghost" | "secondary";
type IconButtonSize = "sm" | "md";
type IconButtonType = "button" | "submit" | "reset";

withDefaults(
  defineProps<{
    label: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    type?: IconButtonType;
    disabled?: boolean;
    active?: boolean;
  }>(),
  {
    variant: "ghost",
    size: "md",
    type: "button",
    disabled: false,
    active: false
  }
);

const baseClass =
  "inline-grid shrink-0 place-items-center rounded-full border font-label font-bold leading-none transition duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-65";

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "border-transparent bg-transparent text-text hover:bg-accent-soft/55 hover:text-text",
  secondary: "border-border-strong bg-surface-muted text-text hover:border-accent hover:bg-surface-raised hover:text-accent"
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-9"
};

const activeClass = "bg-surface-muted text-text";
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    :class="[baseClass, variantClasses[variant], sizeClasses[size], active ? activeClass : '']"
  >
    <slot />
  </button>
</template>
