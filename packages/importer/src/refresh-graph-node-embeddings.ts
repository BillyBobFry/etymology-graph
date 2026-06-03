import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import OpenAI from "openai";
import { Pool, type PoolClient } from "pg";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const targetLangCode = "en";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const embeddingDimensions = 1536;
const databaseUrl = process.env.DATABASE_URL;
const openAiApiKey = process.env.OPENAI_API_KEY;
const pageSize = parsePositiveInteger(process.env.TERM_EMBEDDING_PAGE_SIZE, 500);
const embeddingBatchSize = parsePositiveInteger(process.env.TERM_EMBEDDING_BATCH_SIZE, 100);
const limitTerms = parseOptionalPositiveInteger(process.env.TERM_EMBEDDING_LIMIT);

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

if (!openAiApiKey) {
  throw new Error("OPENAI_API_KEY must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});
const openAi = new OpenAI({ apiKey: openAiApiKey });

let scannedCount = 0;
let embeddedCount = 0;
let cursor: string | undefined;

try {
  while (limitTerms === undefined || embeddedCount < limitTerms) {
    const rows = await loadEnglishNodePage(pool, cursor);
    if (rows.length === 0) {
      break;
    }

    scannedCount += rows.length;
    cursor = rows.at(-1)?.id;

    const candidates = rows
      .map((row) => {
        const content = buildEmbeddingContent(row);
        return {
          langCode: row.lang_code,
          normalizedWord: row.normalized_word,
          word: row.word,
          content,
          contentHash: hashContent(content)
        };
      })
      .filter(
        (candidate, index) =>
          rows[index]?.embedding_model !== embeddingModel ||
          rows[index]?.content_hash !== candidate.contentHash
      );

    const remainingLimit = limitTerms === undefined ? candidates.length : limitTerms - embeddedCount;
    const limitedCandidates = candidates.slice(0, remainingLimit);

    for (const batch of chunk(limitedCandidates, embeddingBatchSize)) {
      const embeddings = await createEmbeddings(batch.map((candidate) => candidate.content));
      const records = batch.map((candidate, index) => ({
        langCode: candidate.langCode,
        normalizedWord: candidate.normalizedWord,
        word: candidate.word,
        model: embeddingModel,
        contentHash: candidate.contentHash,
        embedding: embeddings[index] ?? []
      }));

      await upsertEmbeddingBatch(pool, records);
      embeddedCount += records.length;

      console.log({
        targetLangCode,
        scannedCount,
        embeddedCount,
        lastTerm: records.at(-1)
          ? `${records.at(-1)?.langCode}:${records.at(-1)?.word}`
          : undefined
      });
    }
  }

  console.log({
    targetLangCode,
    model: embeddingModel,
    dimensions: embeddingDimensions,
    scannedCount,
    embeddedCount
  });
} finally {
  await pool.end();
}

type EmbeddingNodeRow = {
  id: string;
  lang_code: string;
  word: string;
  normalized_word: string;
  canonical_name: string | null;
  embedding_model: string | null;
  content_hash: string | null;
};

type EmbeddingRecord = {
  langCode: string;
  normalizedWord: string;
  word: string;
  model: string;
  contentHash: string;
  embedding: number[];
};

/** Parses positive integer environment overrides while keeping unsafe values out of SQL limits. */
function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Parses optional positive integer limits so local dry runs can cap paid embedding calls. */
function parseOptionalPositiveInteger(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Loads one stable page of English graph nodes with any existing embedding metadata. */
async function loadEnglishNodePage(pool: Pool, cursorNodeId: string | undefined): Promise<EmbeddingNodeRow[]> {
  const result = await pool.query<EmbeddingNodeRow>(
    `
      SELECT
        graph_nodes.id,
        graph_nodes.lang_code,
        graph_nodes.word,
        graph_nodes.normalized_word,
        languages.canonical_name,
        term_embeddings.model AS embedding_model,
        term_embeddings.content_hash
      FROM graph_nodes
      LEFT JOIN languages
        ON languages.code = graph_nodes.lang_code
      LEFT JOIN term_embeddings
        ON term_embeddings.lang_code = graph_nodes.lang_code
        AND term_embeddings.normalized_word = graph_nodes.normalized_word
        AND term_embeddings.model = $4
      WHERE graph_nodes.lang_code = $1
        AND ($2::TEXT IS NULL OR graph_nodes.id > $2)
      ORDER BY graph_nodes.id
      LIMIT $3
    `,
    [targetLangCode, cursorNodeId ?? null, pageSize, embeddingModel]
  );

  return result.rows;
}

/** Builds a compact, language-aware text input for multilingual embedding models. */
function buildEmbeddingContent(row: EmbeddingNodeRow): string {
  const languageName = row.canonical_name ?? row.lang_code;

  return [`Language: ${languageName}`, `Language code: ${row.lang_code}`, `Term: ${row.word}`].join("\n");
}

/** Hashes embedding input so refreshes only pay for changed content or changed models. */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Creates OpenAI embeddings in the fixed dimension used by the database vector column. */
async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const response = await openAi.embeddings.create({
    model: embeddingModel,
    input: inputs,
    dimensions: embeddingDimensions
  });

  if (response.data.length !== inputs.length) {
    throw new Error(`OpenAI returned ${response.data.length} embeddings for ${inputs.length} inputs`);
  }

  return response.data.map((embeddingResult) => embeddingResult.embedding);
}

/** Upserts one generated vector batch into pgvector storage. */
async function upsertEmbeddingBatch(client: PoolClient | Pool, records: EmbeddingRecord[]): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO term_embeddings (
        lang_code,
        normalized_word,
        word,
        model,
        content_hash,
        embedding,
        embedded_at
      )
      SELECT
        lang_code,
        normalized_word,
        word,
        model,
        content_hash,
        embedding::vector,
        now()
      FROM jsonb_to_recordset($1::jsonb) AS embeddings(
        lang_code TEXT,
        normalized_word TEXT,
        word TEXT,
        model TEXT,
        content_hash TEXT,
        embedding TEXT
      )
      ON CONFLICT (lang_code, normalized_word, model) DO UPDATE SET
        word = EXCLUDED.word,
        model = EXCLUDED.model,
        content_hash = EXCLUDED.content_hash,
        embedding = EXCLUDED.embedding,
        embedded_at = EXCLUDED.embedded_at
    `,
    [
      JSON.stringify(
        records.map((record) => ({
          lang_code: record.langCode,
          normalized_word: record.normalizedWord,
          word: record.word,
          model: record.model,
          content_hash: record.contentHash,
          embedding: formatVector(record.embedding)
        }))
      )
    ]
  );
}

/** Formats an embedding for pgvector's text input while validating the stored dimension. */
function formatVector(embedding: number[]): string {
  if (embedding.length !== embeddingDimensions) {
    throw new Error(`Expected embedding dimension ${embeddingDimensions}, received ${embedding.length}`);
  }

  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value");
  }

  return `[${embedding.join(",")}]`;
}

/** Splits arrays into bounded batches for provider calls and bulk database writes. */
function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}
