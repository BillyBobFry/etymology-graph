<script setup lang="ts">
import type { LinkEndpoint, PositionedGraphLink } from "./composables/useGraphLayout";
import { edgeLabel, edgeLegendItems, edgeTypeClass, markerUrlForEdgeType, relationshipColorClass } from "./graphRelationshipDisplay";

defineProps<{
  links: PositionedGraphLink[];
  hasResolvedEndpoints: (link: PositionedGraphLink) => boolean;
  linkEndpointX: (link: PositionedGraphLink, endpoint: LinkEndpoint) => number;
  linkEndpointY: (link: PositionedGraphLink, endpoint: LinkEndpoint) => number;
}>();

const graphLinkClass =
  "stroke-[color-mix(in_oklch,var(--relationship-color,var(--theme-graph-edge))_72%,transparent)] stroke-2 [stroke-linecap:round]";
const uncertainGraphLinkClass = "[stroke-dasharray:6_7]";
</script>

<template>
  <defs>
    <marker
      id="arrowhead"
      markerWidth="10"
      markerHeight="10"
      refX="10"
      refY="5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path class="fill-graph-edge" d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
    <marker
      v-for="item in edgeLegendItems"
      :id="`arrowhead-${edgeTypeClass(item.type)}`"
      :key="item.type"
      markerWidth="10"
      markerHeight="10"
      refX="10"
      refY="5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path :class="relationshipColorClass(item.type)" fill="var(--relationship-color)" d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
  </defs>

  <g class="graph-links">
    <g v-for="link in links" :key="link.id">
      <line
        v-if="hasResolvedEndpoints(link)"
        :class="[graphLinkClass, relationshipColorClass(link.type), link.uncertain && uncertainGraphLinkClass]"
        :marker-end="markerUrlForEdgeType(link.type)"
        :x1="linkEndpointX(link, 'target')"
        :y1="linkEndpointY(link, 'target')"
        :x2="linkEndpointX(link, 'source')"
        :y2="linkEndpointY(link, 'source')"
      />
      <title>{{ edgeLabel(link.type) }}</title>
    </g>
  </g>
</template>
