## Word Lineages Atlas

The current word-lineage search lets users choose any result language and any source language. That is too open-ended for the shape of the data and the cost of the query. With roughly 1,500 language codes, the UI appears to support millions of language pairs even though most pairs are empty, slow, or not useful as a first-run product experience.

This project rethinks `/word-lineages/:langCode/:ancestorLangCode` as a curated word-lineage atlas. The primary path should help users explore meaningful historical layers for a chosen language, not ask them to construct arbitrary database queries.

## Problem Statement

`/api/terms-with-ancestor-language` currently scans lexical entries in the descendant language, runs entry-aware ancestor walks for batches of roots, and stops when it has enough matches or has scanned a capped number of batches. Local investigation showed that this is slow for common and sparse pairs:

- `en -> la`, `limit=50`, `maxDepth=8`: about 3 seconds
- `en -> ine-pro`: about 4.5 seconds
- `en -> fr`: about 5.5 seconds
- `en -> non`: about 6.8 seconds while returning only 7 matches

The worst user experience comes from sparse or editorially odd pairs: the API can spend seconds proving that few entries match. A graph database might improve individual traversal mechanics, but the product still should not present every language pair as equally supported.

## Direction

The primary UX should be finite, curated, and coverage-aware:

1. Choose a language to explore.
2. Show important source layers for that language.
3. Let users open a source layer and browse matching entries.
4. Show path evidence for individual matches.

The page should feel like an atlas section, not a two-field query form. Source layers can be editorially curated at first, then enriched with match counts and coverage signals from the database.

## In Scope

### Curated Primary Path

Keep the broad "Words in" language choice, but replace the default arbitrary "Source language" selector with a curated list of source layers for the selected language.

`apps/web/src/features/ancestorLanguage/ancestorLanguageSuggestions.ts` is the current seed for this. It already models meaningful pairs such as:

- English from Old English, Old Norse, Latin, French, Proto-Germanic, Proto-Indo-European
- Spanish from Latin, Arabic, Ancient Greek, Proto-Indo-European
- German from Old High German, Proto-Germanic, Latin, Proto-Indo-European

The first implementation can use this curated list as the supported primary surface.

### Optimize Promoted Pairs

Backend optimization should focus on pairs the UI promotes. This avoids combinatorial materialization across all possible languages.

Good implementation options include:

- cache or materialize only curated `(lang_code, ancestor_lang_code, max_depth)` result sets
- maintain a compact promoted-pair reachability table after imports
- precompute match counts and sample entries for curated pairs
- keep the existing direct endpoint as the execution path for route compatibility while gradually moving promoted pairs to faster lookup

The goal is not to make every possible pair fast. The goal is to make the atlas paths fast and reliable.

### Coverage-Aware Choices

The source-layer cards should eventually include coverage data, for example:

- match count
- whether the layer has enough examples to browse
- representative example words
- maybe deepest/common path depth hints

This turns the page from "try a source language and wait" into "these word lineages are available in the index." It also prevents empty states caused by impossible or weakly covered choices.

### Atlas Page Model

Reshape the route around discovery:

- Page heading: choose a language and explore its source layers.
- Primary control: selected word language.
- Main content: source-layer cards with names, short explanations, and coverage signals.
- Result state: when a layer is selected, show matching entries and path evidence.

The current two-selector form should no longer be the main entry point. Direct routes can still load a selected pair, but the page should visually emphasize the curated layer list.

## Explicit Non-Goal For This Pass

Do not add the advanced arbitrary source-language picker in this project phase.

Power-user arbitrary pair search can come later behind an explicit advanced control, with copy that explains rare pairs may be slow or empty. For now, keep the implementation focused on the supported atlas path.

## Suggested Milestones

### MS1: Curated Atlas UI

- Replace the primary source-language selector with curated source-layer cards.
- Keep route compatibility for existing `/ancestor-languages/:langCode/:ancestorLangCode` links while making `/word-lineages/:langCode/:ancestorLangCode` the canonical route.
- Use the selected route pair to mark the active source layer when it is curated.
- Keep the current API as the data source.

### MS2: Coverage Counts

- Add a backend operation that returns curated source layers for a result language with counts or availability.
- Start with counts for curated pairs only.
- Show counts and disabled/empty treatment for unsupported or uncovered layers.

### MS3: Fast Promoted Pair Lookup

- Build promoted-pair result caches on top of `graph_edge_walk_mv` rather than raw `graph_edges`, so atlas results inherit the default ancestor ambiguity policy.
- Populate it during import or with a post-import refresh command.
- Route promoted source-layer browsing through the fast lookup path.
- Keep the existing recursive query as fallback for direct links if needed.

### MS4: Editorial Expansion

- Review and expand curated source layers by language family and product value.
- Add representative examples for high-value layers.
- Use coverage data to decide which pairs deserve promotion.

## Implementation Notes

- Show languages by canonical name in the UI. Language codes should remain route/API details.
- Empty states should describe atlas coverage, for example "No paths in the index yet" rather than implying no relationship exists.
- The source-layer list should be filtered against available languages and, once MS2 exists, against available coverage.
- Infinite scrolling can remain for result lists, but the initial choice should not trigger expensive searches for arbitrary pairs.
- Preserve `GraphEvidencePanel` behavior for explaining an individual match after selection.

## Open Questions

- Should curated layer definitions live in frontend code, shared graph package data, or the API?
- Should match counts be exact, cached approximate counts, or capped labels such as "50+ matches"?
- Should promoted-pair caches be rebuilt during import, refreshed by a separate command, or lazily filled on first request?
- Should direct non-curated routes show a fallback result page, redirect to the atlas, or show a "not a promoted source layer" state?
