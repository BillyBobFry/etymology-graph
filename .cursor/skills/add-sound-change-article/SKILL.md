---
name: add-sound-change-article
description: Add or revise editorial sound-change articles with comparison-set graphs, modern-language cognate examples, and graph annotations. Use when the user asks to add a sound change page/article such as Grimm's Law, Verner's Law, palatalization, vowel shifts, or when editing sound-change examples and callouts.
---

# Add Sound Change Article

## Goal

Add short editorial articles that explain sound changes and pair them with comparison graphs. Each graph should teach where the change happened and where it did not, not merely show separate etymology paths.

## Core Files

- Article data lives in `apps/web/src/features/soundChanges/soundChanges.ts`.
- Glossary terms live in `apps/web/src/features/glossary/linguisticGlossary.ts`.
- Sound-change pages render through `apps/web/src/views/SoundChangesView.vue` and `apps/web/src/views/SoundChangeArticleView.vue`.
- Comparison graphs use `POST /api/comparison-set` through `apps/web/src/features/soundChanges/useComparisonSetQuery.ts`.
- Graph callouts use `GraphNodeAnnotation` and render through `apps/web/src/features/graph/GraphCanvasAnnotations.vue`.

## Workflow

1. Before drafting, do lightweight source research:
   - Read the relevant Wikipedia page when one exists. Distill the durable factual structure: what changed, conditioning environment, affected languages or branches, chronology, named exceptions, and canonical examples.
   - Check Wiktionary entries for candidate examples because their etymology, descendant, and cognate data are most likely to line up with the app's graph data.
   - Query the local API for candidate modern terms and comparison sets before finalizing examples. If a modern-language word is missing entirely, add it to the appropriate seed data when it is a good editorial example. If the modern word exists but the comparison-set API omits one or more targets, inspect the database paths and usually choose the nearest shared root that connects every selected lineage.
   - For complex, contested, or example-sensitive changes, consult one corroborating source such as Index Diachronica, a cited linguistics reference from Wikipedia, a university lecture note, or a historical linguistics textbook/handbook.
   - Do not copy prose, and cross-check proposed examples against the app's available graph data before using them.
2. Define the sound change as an editorial article entry in `soundChangeArticles`. For a batch of articles, apply the full checklist to each article instead of treating the batch as one large article.
3. Keep the article short: overview, affected languages, families, and 2-4 explanatory sections.
4. Apply the glossary checklist below to the overview and section body copy.
5. Add 2-4 comparison examples. Each example should represent one clear correspondence pattern, such as `p → f`.
6. For each example, use one shared source/root form and grouped target terms:
   - `shifted`: cognates on the branch that underwent the sound change.
   - `comparisons`: cognates on branches that did not undergo that sound change.
7. Prefer English as one visible example when it is relevant to the sound change, because it is the broadest audience anchor.
8. When English is not relevant, choose clear examples from the affected language family or region instead of forcing an English term.
9. Vary the example languages across patterns. Avoid repeating the same affected-language pair or the same comparison-language pair in every example.
10. Prefer modern visible terms when they make the contrast easier for readers. Use older branch forms for callouts when they better identify where the change did or did not happen.
11. Choose comparison languages that did not undergo the sound change and make the contrast clear. They do not need to be from a single family, as long as they share the selected root or comparison basis.
12. When a change is defined against a direct source language and there is no natural unaffected daughter branch, a source-form comparison item is acceptable if it makes the contrast clearer than forcing an unrelated borrowing.
13. Add node annotations that point at the historically meaningful forms:

- `tone: "shifted"` for the branch/node where the sound change took effect.
- `tone: "unchanged"` for a comparison branch/node that did not undergo the change.
- Use `fallbackTargets` when the ideal proto-node may not be present in imported data.

14. Run focused validation after edits.

## Comparison Graph Rules

- Do not render one graph per cognate. Use one merged comparison-set graph per example so users can compare branches at once.
- The comparison-set API should stay generic. Do not add article-specific API routes such as `/api/grimms-law`.
- Keep sound-change semantics in editorial metadata and annotations, not in database edge types.
- Keep `root` stable across all items in an example. If a proposed target does not connect to the same root in imported data, either choose a better target or note that the path may be absent.
- Use the exact source form consistently within an example. Accents, reconstructed markers, and script choices should match between every `from.term` and any same-language source comparison item.

## Example Pattern

```ts
{
  id: "pattern-id",
  title: "sound A becomes sound B",
  pattern: "Source sound A → affected-branch sound B",
  shiftedLabel: "Affected reflexes with sound B",
  comparisonLabel: "Modern cognates without the shift",
  shifted: [
    // Prefer English when the sound change has a useful English reflex.
    { id: "english-example", label: "English example", from: sharedRoot, to: englishExample },
    // Pick a second affected-language example that fits this sound change.
    { id: "affected-example", label: "Affected language example", from: sharedRoot, to: affectedExample }
  ],
  comparisons: [
    // Use varied modern comparison languages that did not undergo this change.
    { id: "comparison-one", label: "Comparison language one", from: sharedRoot, to: comparisonOne },
    { id: "comparison-two", label: "Comparison language two", from: sharedRoot, to: comparisonTwo }
  ],
  annotations: [
    {
      id: "pattern-shifted-branch",
      target: { langCode: "affected-proto-or-language", word: "changed form" },
      tone: "shifted",
      title: "Changed branch form",
      body: "This branch shows where the sound change took effect."
    },
    {
      id: "pattern-unchanged-branch",
      target: { langCode: "comparison-proto-or-language", word: "unchanged form" },
      fallbackTargets: [{ langCode: "comparison-language", word: "fallback form" }],
      tone: "unchanged",
      title: "Comparison branch form",
      body: "This branch did not undergo the sound change."
    }
  ]
}
```

## Writing Guidance

- Explain what changed, where it changed, and how modern descendants show the effect.
- Use direct article copy. Avoid hedging and hype.
- Avoid implementation details in user-facing text. Say `graph`, `source form`, `branch`, `lineage`, and `cognate`, not API endpoint or database.
- Make annotations concrete and local to a node: "This branch shows p → f" is better than a broad restatement of the article.

## Glossary Checklist

- Treat glossary tooltip coverage as part of article authoring, not a polish pass. Before finishing, scan `overview` and each `sections[].body` for specialist terms a non-linguist may not know.
- Prefer annotating terms such as `cognate`, `reflex`, `descendant`, `lineage`, `reconstructed`, `stop consonant`, `voiceless stop`, `voiced stop`, `fricative`, `affricate`, `sibilant`, `palatal`, `palatal stop`, `front vowel`, `stress`, and similarly technical terms introduced by the article.
- Reuse existing `GlossaryTextSegment` annotations. If a helpful term is missing, add it to `apps/web/src/features/glossary/linguisticGlossary.ts` before referencing its `termId`.
- Annotate the first useful occurrence or the place where the term is most explanatory. Do not annotate every repetition.
- Keep compact strings plain unless inline glossary interaction is clearly useful. This usually means no glossary segments in titles, subtitles, labels, graph example metadata, or annotation callout bodies.
- Keep tooltip definitions short, contextual, and reader-facing. If a tooltip needs more than one or two sentences, simplify the article copy instead.

## Validation

Run:

```bash
pnpm --filter @etymology-graph/web typecheck
```

If shared graph types or API comparison-set behavior changes, run:

```bash
pnpm typecheck
```

Check lints on every edited frontend/API file.
