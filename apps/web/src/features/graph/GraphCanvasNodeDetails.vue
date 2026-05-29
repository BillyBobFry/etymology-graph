<script setup lang="ts">
import { ExternalLink, X } from "@lucide/vue";

import type { NodeActionItem, NodeContextAction, SelectedNodeRelationship } from "./graphNodeActions";
import { formatDetailedIpa } from "./graphNodeDisplay";
import { edgeLabel, relationshipColorClass } from "./graphRelationshipDisplay";
import Badge from "../../uiComponents/Badge.vue";
import Button from "../../uiComponents/Button.vue";
import IconButton from "../../uiComponents/IconButton.vue";
import type { PositionedGraphNode } from "./composables/useGraphLayout";

defineProps<{
  node: PositionedGraphNode;
  relationships: SelectedNodeRelationship[];
  actions: NodeActionItem[];
  wiktionaryHref?: string;
  expanded: boolean;
}>();

const emit = defineEmits<{
  close: [];
  action: [action: NodeContextAction];
}>();

const nodeDetailCardClass =
  "absolute bottom-4 right-4 z-[1] grid w-[min(360px,calc(100%_-_32px))] gap-3 rounded-md border border-border-strong/80 bg-surface-raised/95 p-4 shadow-overlay";
const expandedNodeDetailCardClass = "bottom-5 right-5 max-h-[calc(100dvh_-_112px)] overflow-auto";
const nodeDetailKickerClass =
  "font-label text-xs font-bold uppercase tracking-[0.12em] text-text-muted";
const nodeDetailHeadingClass = "flex items-start gap-3";
const nodeDetailTitleClass = "text-[26px] font-bold leading-[1.1] text-text";
const nodeDetailActionsClass = "grid grid-cols-1 gap-2 md:hidden";
const nodeDetailListClass = "grid gap-2.5";
const nodeDetailTermClass = "font-label text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted";
const nodeDetailDescriptionClass = "mt-0.5 text-sm leading-normal text-text";
const selectedRelationshipsClass = "mt-0.5 grid list-none gap-2 p-0";
const selectedRelationshipClass = "inline-flex max-w-full flex-wrap items-center gap-1.5 whitespace-nowrap";
const relationshipBadgeClass = "[--badge-color:var(--relationship-color,var(--theme-graph-edge))]";
const relationshipUncertaintyClass = "inline-flex items-center gap-0.5";

/** Keeps relationship rows concise while preserving language context. */
function relationshipNodeLabel(node: PositionedGraphNode): string {
  return `${node.word} (${node.langName ?? node.langCode})`;
}
</script>

<template>
  <aside :class="[nodeDetailCardClass, expanded && expandedNodeDetailCardClass]" aria-live="polite">
    <div class="flex items-center justify-between">
      <p :class="nodeDetailKickerClass">{{ node.langName ?? node.langCode }}</p>
      <IconButton label="Close" size="sm" @click="emit('close')">
        <X :size="16" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
    </div>
    <div :class="nodeDetailHeadingClass">
      <h3 :class="nodeDetailTitleClass">{{ node.word }}</h3>
      <IconButton
        v-if="wiktionaryHref"
        label="Open Wiktionary entry"
        size="xs"
        :href="wiktionaryHref"
        target="_blank"
      >
        <ExternalLink :size="14" stroke-width="2.75" aria-hidden="true" />
      </IconButton>
    </div>

    <dl :class="nodeDetailListClass">
      <div v-if="formatDetailedIpa(node)">
        <dt :class="nodeDetailTermClass">Pronunciation</dt>
        <dd :class="nodeDetailDescriptionClass">{{ formatDetailedIpa(node) }}</dd>
      </div>
      <div v-if="node.lexicalSummary?.pos">
        <dt :class="nodeDetailTermClass">Part of speech</dt>
        <dd :class="nodeDetailDescriptionClass">{{ node.lexicalSummary.pos }}</dd>
      </div>
      <div v-if="node.lexicalSummary?.definition">
        <dt :class="nodeDetailTermClass">Definition</dt>
        <dd :class="nodeDetailDescriptionClass">{{ node.lexicalSummary.definition }}</dd>
      </div>
      <div v-if="node.lexicalSummary?.entryCount && node.lexicalSummary.entryCount > 1">
        <dt :class="nodeDetailTermClass">Entries</dt>
        <dd :class="nodeDetailDescriptionClass">{{ node.lexicalSummary.entryCount }} lexical entries imported</dd>
      </div>
      <div v-if="relationships.length > 0">
        <dt :class="nodeDetailTermClass">Relationships</dt>
        <dd :class="nodeDetailDescriptionClass">
          <ul :class="selectedRelationshipsClass">
            <li v-for="relationship in relationships" :key="relationship.id" :class="selectedRelationshipClass">
              <Badge variant="custom" :class="[relationshipBadgeClass, relationshipColorClass(relationship.type)]">
                {{ edgeLabel(relationship.type) }}
              </Badge>
              <span class="text-text">
                {{ relationshipNodeLabel(relationship.otherNode) }}
              </span>
              <span v-if="relationship.uncertain" :class="relationshipUncertaintyClass">
                (<Badge variant="custom" :class="[relationshipBadgeClass, '[--relationship-color:var(--theme-text-muted)]']">Uncertain</Badge>)
              </span>
            </li>
          </ul>
        </dd>
      </div>
    </dl>

    <div :class="nodeDetailActionsClass" role="group" aria-label="Node actions">
      <Button
        v-for="item in actions"
        :key="item.value"
        variant="secondary"
        size="sm"
        full-width
        @click="emit('action', item.value)"
      >
        {{ item.label }}
      </Button>
    </div>
  </aside>
</template>
