<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

type LinkVariant = "inline" | "list" | "plain";

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(
  defineProps<{
    to?: RouteLocationRaw;
    href?: string;
    target?: string;
    rel?: string;
    variant?: LinkVariant;
  }>(),
  {
    variant: "inline"
  }
);

const isRouterLink = computed(() => props.to !== undefined);
const externalRel = computed(() => props.rel ?? (props.target === "_blank" ? "noreferrer" : undefined));
const baseClass =
  "cursor-pointer transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const variantClasses: Record<LinkVariant, string> = {
  inline:
    "rounded-[2px] font-bold text-text underline decoration-accent/45 decoration-1 underline-offset-[0.2em] hover:text-accent hover:decoration-accent",
  list: "rounded-[2px] font-label text-sm text-text-muted hover:text-text",
  plain: "rounded-[3px]"
};
const linkClass = computed(() => [
  baseClass,
  variantClasses[props.variant]
]);
</script>

<template>
  <RouterLink v-if="isRouterLink && to" v-bind="$attrs" :to="to" :class="linkClass">
    <slot />
  </RouterLink>
  <a v-else v-bind="$attrs" :href="href" :target="target" :rel="externalRel" :class="linkClass">
    <slot />
  </a>
</template>
