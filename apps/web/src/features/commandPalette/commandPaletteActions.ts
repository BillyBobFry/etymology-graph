import type { RouteLocationRaw } from "vue-router";

import { linguisticGlossaryTerms } from "../glossary/linguisticGlossary";
import { soundChangeArticles } from "../soundChanges/soundChanges";

export type CommandPaletteActionGroup = "Navigate" | "Reference" | "Sound changes";

export type CommandPaletteAction = {
  id: string;
  label: string;
  description: string;
  group: CommandPaletteActionGroup;
  keywords: string[];
  to: RouteLocationRaw;
};

const primaryNavigationActions: CommandPaletteAction[] = [
  {
    id: "route:etymology-search",
    label: "Search word lineages",
    description: "Open a term and follow its source trail.",
    group: "Navigate",
    keywords: ["etymology", "word", "lineage", "search", "term"],
    to: { name: "etymology-search" }
  },
  {
    id: "route:doublets-search",
    label: "Browse doublets",
    description: "Find entries that split from one older source.",
    group: "Navigate",
    keywords: ["doublet", "doublets", "shared source", "related words"],
    to: { name: "doublets-search" }
  },
  {
    id: "route:ancestor-language-search",
    label: "Compare source languages",
    description: "List words by the language they trace through.",
    group: "Navigate",
    keywords: ["ancestor", "language", "source", "borrowed", "inherited"],
    to: { name: "ancestor-language-search" }
  },
  {
    id: "route:sound-changes",
    label: "Read sound changes",
    description: "Study pronunciation shifts through examples.",
    group: "Navigate",
    keywords: ["sound", "change", "article", "pronunciation", "phonology"],
    to: { name: "sound-changes" }
  },
  {
    id: "route:glossary",
    label: "Open glossary",
    description: "Look up linguistic terms used across the atlas.",
    group: "Navigate",
    keywords: ["glossary", "definition", "reference", "vocabulary"],
    to: { name: "glossary" }
  }
];

/** Keeps the command palette catalogue local to this removable feature. */
export const commandPaletteActions: CommandPaletteAction[] = [
  ...primaryNavigationActions,
  ...Object.values(linguisticGlossaryTerms).map((term): CommandPaletteAction => ({
    id: `glossary:${term.id}`,
    label: term.label,
    description: term.shortDefinition,
    group: "Reference",
    keywords: [term.label, ...term.aliases, term.shortDefinition],
    to: {
      name: "glossary",
      hash: `#${term.id}`
    }
  })),
  ...soundChangeArticles.map((article): CommandPaletteAction => ({
    id: `sound-change:${article.slug}`,
    label: article.title,
    description: article.subtitle,
    group: "Sound changes",
    keywords: [article.title, article.subtitle, ...article.affectedLanguages, ...article.families],
    to: {
      name: "sound-change-article",
      params: {
        slug: article.slug
      }
    }
  }))
];
