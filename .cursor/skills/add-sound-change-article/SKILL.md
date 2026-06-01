---
name: add-sound-change-article
description: Add or revise editorial sound-change articles with comparison-set graphs, modern-language cognate examples, and graph annotations. Use when the user asks to add a sound change page/article such as Grimm's Law, Verner's Law, palatalization, vowel shifts, or when editing sound-change examples and callouts.
---

# Add Sound Change Article

## Goal

Add a short editorial article that explains one sound change and pairs it with comparison graphs. The graph should teach where the change happened and where it did not, not merely show separate etymology paths.

## Core Files

- Article data lives in `apps/web/src/features/soundChanges/soundChanges.ts`.
- Sound-change pages render through `apps/web/src/views/SoundChangesView.vue` and `apps/web/src/views/SoundChangeArticleView.vue`.
- Comparison graphs use `POST /api/comparison-set` through `apps/web/src/features/soundChanges/useComparisonSetQuery.ts`.
- Graph callouts use `GraphNodeAnnotation` and render through `apps/web/src/features/graph/GraphCanvasAnnotations.vue`.

## Workflow

1. Define the sound change as an editorial article entry in `soundChangeArticles`.
2. Keep the article short: overview, affected languages, families, and 2-4 explanatory sections.
3. Add 2-4 comparison examples. Each example should represent one clear correspondence pattern, such as `p -> f`.
4. For each example, use one shared source/root form and grouped target terms:
   - `shifted`: cognates on the branch that underwent the sound change.
   - `comparisons`: cognates on branches that did not undergo that sound change.
5. Prefer English as one visible example when it is relevant to the sound change, because it is the broadest audience anchor.
6. When English is not relevant, choose clear examples from the affected language family or region instead of forcing an English term.
7. Vary the example languages across patterns. Avoid repeating the same affected-language pair or the same comparison-language pair in every example.
8. Prefer modern visible terms when they make the contrast easier for readers. Use older branch forms for callouts when they better identify where the change did or did not happen.
9. Choose comparison languages that did not undergo the sound change and make the contrast clear. They do not need to be from a single family, as long as they share the selected root or comparison basis.
10. Add node annotations that point at the historically meaningful forms:
   - `tone: "shifted"` for the branch/node where the sound change took effect.
   - `tone: "unchanged"` for a comparison branch/node that did not undergo the change.
   - Use `fallbackTargets` when the ideal proto-node may not be present in imported data.
11. Run focused validation after edits.

## Comparison Graph Rules

- Do not render one graph per cognate. Use one merged comparison-set graph per example so users can compare branches at once.
- The comparison-set API should stay generic. Do not add article-specific API routes such as `/api/grimms-law`.
- Keep sound-change semantics in editorial metadata and annotations, not in database edge types.
- Keep `root` stable across all items in an example. If a proposed target does not connect to the same root in imported data, either choose a better target or note that the path may be absent.

## Example Pattern

```ts
{
  id: "pattern-id",
  title: "sound A becomes sound B",
  pattern: "Source sound A -> affected-branch sound B",
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
- Make annotations concrete and local to a node: "This branch shows p -> f" is better than a broad restatement of the article.

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
