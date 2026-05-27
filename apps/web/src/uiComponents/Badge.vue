<script setup lang="ts">
type BadgeVariant = "neutral" | "custom";

withDefaults(
  defineProps<{
    variant?: BadgeVariant;
  }>(),
  {
    variant: "neutral"
  }
);

const baseClass = "badge font-label";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "badge-neutral",
  custom: "badge-custom"
};
</script>

<template>
  <span :class="[baseClass, variantClasses[variant]]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-neutral {
  border: 1px solid color-mix(in oklch, var(--theme-border-strong) 68%, transparent);
  background: color-mix(in oklch, var(--theme-surface-muted) 62%, transparent);
  color: var(--theme-text-muted);
  padding: 3px 7px;
}

.badge-custom {
  border: 1px solid color-mix(in oklch, var(--badge-color, currentColor) 52%, transparent);
  background: color-mix(in oklch, var(--badge-color, currentColor) 12%, transparent);
  color: var(--badge-color, currentColor);
  padding: 4px 7px 3px;
}
</style>
