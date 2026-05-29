<script setup lang="ts">
type SkeletonVariant = "line" | "block" | "circle";
type SkeletonTone = "muted" | "raised";

withDefaults(
  defineProps<{
    variant?: SkeletonVariant;
    tone?: SkeletonTone;
    animated?: boolean;
  }>(),
  {
    variant: "line",
    tone: "muted",
    animated: true
  }
);

const baseClass = "skeleton";

const variantClasses: Record<SkeletonVariant, string> = {
  line: "h-4 w-full rounded-[6px]",
  block: "h-24 w-full rounded-md",
  circle: "size-10 rounded-full"
};

const toneClasses: Record<SkeletonTone, string> = {
  muted: "skeleton-muted",
  raised: "skeleton-raised"
};
</script>

<template>
  <span
    :class="[baseClass, variantClasses[variant], toneClasses[tone], animated ? 'skeleton-animated' : '']"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  display: block;
  border: 1px solid color-mix(in oklch, var(--theme-border) 68%, transparent);
  overflow: hidden;
  position: relative;
}

.skeleton-muted {
  background:
    linear-gradient(
      135deg,
      color-mix(in oklch, var(--theme-surface-muted) 88%, transparent),
      color-mix(in oklch, var(--theme-surface) 76%, transparent)
    ),
    var(--theme-surface-muted);
}

.skeleton-raised {
  background:
    linear-gradient(
      135deg,
      color-mix(in oklch, var(--theme-surface-raised) 88%, transparent),
      color-mix(in oklch, var(--theme-surface-muted) 68%, transparent)
    ),
    var(--theme-surface-raised);
}

.skeleton::before {
  background-image:
    linear-gradient(color-mix(in oklch, var(--theme-border-strong) 12%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklch, var(--theme-border-strong) 10%, transparent) 1px, transparent 1px);
  background-size: 18px 18px;
  content: "";
  inset: 0;
  opacity: 0.38;
  position: absolute;
}

.skeleton-animated {
  animation: skeleton-breathe 1.7s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-animated {
    animation: none;
  }
}

@keyframes skeleton-breathe {
  0%,
  100% {
    opacity: 0.58;
  }

  50% {
    opacity: 0.92;
  }
}
</style>
