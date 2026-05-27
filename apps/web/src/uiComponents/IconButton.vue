<script setup lang="ts">
type IconButtonVariant = "ghost" | "secondary";
type IconButtonSize = "xs" | "sm" | "md";
type IconButtonType = "button" | "submit" | "reset";

withDefaults(
  defineProps<{
    label: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    type?: IconButtonType;
    disabled?: boolean | 'true' | 'false';
    active?: boolean | 'true' | 'false';
  }>(),
  {
    variant: "ghost",
    size: "md",
    type: "button",
    disabled: false,
    active: false
  }
);


const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "border-transparent bg-transparent text-text hover:bg-surface-muted hover:text-text",
  secondary: "border-border-strong bg-surface-muted text-text hover:border-accent hover:bg-surface-raised hover:text-accent"
};

const sizeClasses: Record<IconButtonSize, string> = {
  xs: "size-7",
  sm: "size-8",
  md: "size-9"
};

</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    class="cursor-pointer inline-grid shrink-0 place-items-center rounded-full border font-label font-bold leading-none transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background  disabled:opacity-65"
    :class="[variantClasses[variant], sizeClasses[size], active && 'bg-surface-muted!']"
  >
    <slot />
  </button>
</template>
