# Corpora Seed Data

Curated multilingual seed concepts derived from English [dariusk/corpora](https://github.com/dariusk/corpora) source terms.

- License: CC0-1.0; see `LICENSE.md`.
- Retrieved: 2026-05-28.
- Manifest: `manifest.json` records the reviewed upstream files, JSON keys, and curation policy.
- Concept file: `concepts.json`.
- Concepts: 1928.
- Active concepts: 980 after `exclusions.json`.
- Active language targets: 22325 across English and translated terms (21139 unique loader target specs).
- Translated active concepts: 795.

This dataset intentionally includes ordinary lexical categories such as animals, fruit, body parts, materials, and color names, while avoiding noisier Corpora files such as brands, beers, cocktails, celebrities, quotes, teams, broad technical glossaries, and other proper-noun-heavy lists. Committed concepts are filtered to single-token alphabetic English terms, excluding multi-word names and punctuation-heavy variants from the upstream lists.

`exclusions.json` is a harsh, reviewable denylist. Remove terms from that file to include them in popular seed extraction.

## Category Counts

Counts reflect committed concepts after term-level filters. A concept may appear in more than one category.

- animals/common: 137
- foods/fruits: 69
- foods/vegetables: 83
- foods/herbs-and-spices: 85
- foods/breads-and-pastries: 42
- foods/condiments: 49
- foods/fish: 58
- foods/poultry: 10
- foods/shellfish: 35
- plants/flowers: 54
- plants/common-names: 186
- objects/clothing: 81
- objects/containers: 40
- materials/natural: 14
- materials/building: 33
- materials/metals: 93
- materials/fabrics: 172
- materials/fibers: 18
- materials/gemstones: 326
- colors/web: 140
- core/basic-verbs: 38
- core/body-and-senses: 35
- core/culture-common: 49
- core/home-tools: 54
- core/kinship-and-people: 31
- core/natural-world: 47
- science/elements: 118
- words/units-of-time: 17
- humans/body-parts: 45
- humans/family-relations: 8
