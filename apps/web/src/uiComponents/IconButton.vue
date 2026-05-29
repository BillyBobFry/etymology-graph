<script setup lang="ts">
type IconButtonVariant = "ghost" | "secondary";
type IconButtonSize = "xs" | "sm" | "md";
type IconButtonType = "button" | "submit" | "reset";

const props = withDefaults(
  defineProps<{
    label: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    type?: IconButtonType;
    href?: string;
    disabled?: boolean | "true" | "false";
    active?: boolean | "true" | "false";
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
  ghost: "border-transparent bg-transparent text-text hover:bg-background hover:brightness-95",
  secondary: "border-border-strong bg-surface-muted text-text hover:border-border-strong hover:brightness-95"
};

const sizeClasses: Record<IconButtonSize, string> = {
  xs: "size-7",
  sm: "size-8",
  md: "size-9"
};

</script>

<template>
  <component
    :is="props.href ? 'a' : 'button'"
    :type="props.href ? undefined : props.type"
    :href="props.href"
    :disabled="props.href ? undefined : props.disabled"
    :aria-disabled="props.href && props.disabled ? 'true' : undefined"
    :aria-label="props.label"
    :title="props.label"
    class="cursor-pointer inline-grid shrink-0 place-items-center rounded-full border font-label font-bold leading-none transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background  disabled:opacity-65"
    :class="[variantClasses[props.variant], sizeClasses[props.size], props.active && 'bg-surface-muted!']"
  >
    <slot />
  </component>
</template>
