<script setup lang="ts">
import { CircleHelp, ExternalLink, X } from "@lucide/vue";
import { computed } from "vue";

import type { NodeActionItem, NodeContextAction, SelectedNodeRelationship } from "./graphNodeActions";
import { formatDetailedIpa } from "./graphNodeDisplay";
import { edgeLabel, relationshipColorClass } from "./graphRelationshipDisplay";
import Badge from "../../uiComponents/Badge.vue";
import Button from "../../uiComponents/Button.vue";
import IconButton from "../../uiComponents/IconButton.vue";
import Link from "../../uiComponents/Link.vue";
import Tooltip from "../../uiComponents/Tooltip.vue";
import { useLanguageDetailQuery } from "../languages/useLanguageDetailQuery";
import type { PositionedGraphNode } from "./composables/useGraphLayout";

const props = defineProps<{
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

const languageDetailQuery = useLanguageDetailQuery(() => props.node.langCode);
const languageDetail = computed(() => languageDetailQuery.data.value?.language);
const languageName = computed(() => languageDetail.value?.canonicalName ?? props.node.langName ?? props.node.langCode);
const detailItems = computed(() =>
  [
    formatDetailedIpa(props.node),
    props.node.lexicalSummary?.pos,
    props.node.lexicalSummary?.definition,
    props.node.lexicalSummary?.entryCount && props.node.lexicalSummary.entryCount > 1
      ? `${props.node.lexicalSummary.entryCount} dictionary entries`
      : undefined
  ].filter((item): item is string => Boolean(item))
);

const nodeDetailCardClass =
  "absolute bottom-4 right-4 z-[1] grid w-[min(360px,calc(100%_-_32px))] gap-3 rounded-md border border-border-strong/80 bg-surface-raised/95 p-4 shadow-overlay";
const expandedNodeDetailCardClass = "bottom-5 right-5 max-h-[calc(100dvh_-_112px)] overflow-auto";
const nodeDetailHeadingClass = "flex items-start gap-3";
const nodeDetailTitleClass = "text-[26px] font-bold leading-[1.1] text-text";
const nodeDetailActionsClass = "grid grid-cols-1 gap-2 md:hidden";
const inlineDetailListClass = "flex flex-wrap items-baseline gap-y-1 text-sm leading-6 text-text-muted";
const inlineDetailItemClass = "after:mx-2 after:text-text-muted after:content-['·'] last:after:hidden";
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
      <div class="flex items-center gap-1.5">
        <Link :to="{ name: 'language-detail', params: { langCode: node.langCode } }">
          {{ languageName }}
        </Link>
        <Tooltip
          v-if="languageDetail?.shortDescription"
          :positioning="{ placement: 'bottom-start', strategy: 'fixed', gutter: 6 }"
          content-class="w-[min(300px,calc(100vw_-_48px))]"
        >
          <template #trigger="{ triggerProps, isOpen, toggleFromClick }">
            <IconButton
              v-bind="triggerProps"
              :label="`About ${languageName}`"
              size="xs"
              :active="isOpen"
              @click="toggleFromClick"
            >
              <CircleHelp :size="14" stroke-width="2.75" aria-hidden="true" />
            </IconButton>
          </template>

          <template #default="{ titleProps, descriptionProps }">
            <p v-bind="titleProps" class="mb-2 font-label text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
              {{ languageName }}
            </p>
            <p v-bind="descriptionProps" class="text-sm leading-6 text-text-muted">
              {{ languageDetail.shortDescription }}
            </p>
          </template>
        </Tooltip>
      </div>
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

    <dl v-if="detailItems.length > 0" :class="inlineDetailListClass">
      <template v-if="formatDetailedIpa(node)">
        <dt class="sr-only">Pronunciation</dt>
        <dd :class="inlineDetailItemClass">{{ formatDetailedIpa(node) }}</dd>
      </template>
      <template v-if="node.lexicalSummary?.pos">
        <dt class="sr-only">Part of speech</dt>
        <dd :class="inlineDetailItemClass">{{ node.lexicalSummary.pos }}</dd>
      </template>
      <template v-if="node.lexicalSummary?.definition">
        <dt class="sr-only">Definition</dt>
        <dd :class="inlineDetailItemClass">{{ node.lexicalSummary.definition }}</dd>
      </template>
      <template v-if="node.lexicalSummary?.entryCount && node.lexicalSummary.entryCount > 1">
        <dt class="sr-only">Entries</dt>
        <dd :class="inlineDetailItemClass">{{ node.lexicalSummary.entryCount }} dictionary entries</dd>
      </template>
    </dl>

    <dl v-if="relationships.length > 0" class="grid gap-2.5">
      <div v-if="relationships.length > 0">
        <dt class="font-label text-[11px] font-bold uppercase tracking-widest text-text-muted">Relationships</dt>
        <dd class="mt-0.5 text-sm leading-normal text-text">
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
