## Term Embeddings

Term embeddings support semantic "similar terms" features without changing the core etymology graph model.

## Current Shape

Embeddings live in Postgres through pgvector. The storage table is `term_embeddings`, keyed by stable term identity instead of `graph_nodes.id`:

- `lang_code`
- `normalized_word`
- `model`

The table also stores the latest display `word`, `content_hash`, `embedding`, and `embedded_at`.

Do not make embeddings a child table of `graph_nodes`. Full graph reimports and migration `004_edge_entry_attribution.sql` can truncate `graph_nodes` cascade, and embeddings should survive those rebuilds when the term identity has not changed.

## Embedding Input

The first refresh path embeds compact, language-aware text for English terms only:

```text
Language: English
Language code: en
Term: bread
Part of speech: noun
Definition: a foodstuff made by baking dough
```

OpenAI embedding models do not take a separate language parameter. Include language context directly in the input text so short or ambiguous words are embedded with the intended language. Include the deterministic lexical summary when available, especially primary part of speech and primary gloss, so short words such as `sun` are grounded by meaning rather than only by their surface form.

## Refresh Command

Generate or update English term embeddings with:

```bash
pnpm embeddings:refresh:english
```

Required environment:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/etymology_graph
OPENAI_API_KEY=...
```

Useful local limits:

```bash
TERM_EMBEDDING_LIMIT=100 pnpm embeddings:refresh:english
TERM_EMBEDDING_BATCH_SIZE=50 pnpm embeddings:refresh:english
OPENAI_EMBEDDING_MODEL=text-embedding-3-small pnpm embeddings:refresh:english
```

The script scans current English `graph_nodes`, joins language and lexical summary data, joins existing `term_embeddings` by `(lang_code, normalized_word, model)`, hashes the generated input text, skips unchanged rows, and upserts vectors. If the graph database is empty, the script exits with `scannedCount: 0` and `embeddedCount: 0`.

## Query Direction

Similar-term queries should anchor on a live graph node or `(langCode, word)`, join to `term_embeddings` by `(lang_code, normalized_word)`, rank candidates with pgvector cosine distance, then join results back to current `graph_nodes` for display.

Keep vector SQL behind `GraphRepository`; API handlers should call a graph operation such as `findSimilarTerms` rather than embedding pgvector-specific SQL in route handlers.
