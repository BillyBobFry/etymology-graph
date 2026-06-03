import { previewStructuredEntry, processJsonlInBatches } from "./wiktextract.js";

const inputPath = process.env.IMPORT_INPUT_PATH ?? "../../wikidata_downloads/seeds/structured-ancestry-seed.jsonl";
const checkpointPath =
  process.env.IMPORT_CHECKPOINT_PATH ?? "../../wikidata_downloads/checkpoints/structured-ancestry-preview.json";
const batchSize = Number(process.env.IMPORT_BATCH_SIZE ?? 100);
const limitRecords = process.env.IMPORT_LIMIT_RECORDS ? Number(process.env.IMPORT_LIMIT_RECORDS) : undefined;

let previewedRecords = 0;
let previewedNodes = 0;
let previewedEdges = 0;
let previewedLexicalEntries = 0;

const checkpoint = await processJsonlInBatches({
  inputPath,
  checkpointPath,
  batchSize,
  limitRecords,
  onBatch(batch) {
    for (const record of batch.records) {
      const preview = previewStructuredEntry(record.entry);
      previewedRecords += 1;
      previewedNodes += preview.nodes.length;
      previewedEdges += preview.edges.length;
      previewedLexicalEntries += preview.lexicalEntries.length;
    }

    console.log({
      batchStartLine: batch.startLineNumber,
      batchEndLine: batch.endLineNumber,
      batchRecords: batch.records.length,
      nextByteOffset: batch.nextByteOffset
    });
  }
});

console.log({
  inputPath,
  checkpointPath,
  previewedRecords,
  previewedNodes,
  previewedEdges,
  previewedLexicalEntries,
  checkpoint
});
