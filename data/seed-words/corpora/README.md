# Corpora Seed Data

Curated multilingual seed concepts derived from English [dariusk/corpora](https://github.com/dariusk/corpora) source terms.

- License: CC0-1.0; see `LICENSE.md`.
- Retrieved: 2026-05-28.
- Manifest: `manifest.json` records the reviewed upstream files, JSON keys, and curation policy.
- Concept file: `concepts.json`.
- Concepts: 1663.
- Active concepts: 715 after `exclusions.json`.
- Active language targets: 20090 across English and translated terms.
- Translated active concepts: 671.

This dataset intentionally includes ordinary lexical categories such as animals, fruit, body parts, materials, and color names, while avoiding noisier Corpora files such as brands, beers, cocktails, celebrities, quotes, teams, broad technical glossaries, and other proper-noun-heavy lists. Committed concepts are filtered to single-token alphabetic English terms, excluding multi-word names and punctuation-heavy variants from the upstream lists.

`exclusions.json` is a harsh, reviewable denylist. Remove terms from that file to include them in popular seed extraction.

## Category Counts

Counts reflect committed concepts after term-level filters. A concept may appear in more than one category.

- animals/common: 125
- foods/fruits: 69
- foods/vegetables: 81
- foods/herbs-and-spices: 85
- foods/breads-and-pastries: 40
- foods/condiments: 45
- foods/fish: 58
- foods/poultry: 8
- foods/shellfish: 33
- plants/flowers: 54
- plants/common-names: 183
- objects/clothing: 77
- objects/containers: 39
- materials/natural: 8
- materials/building: 31
- materials/metals: 92
- materials/fabrics: 172
- materials/fibers: 18
- materials/gemstones: 326
- colors/web: 140
- science/elements: 118
- words/units-of-time: 15
- humans/body-parts: 39
- humans/family-relations: 5
