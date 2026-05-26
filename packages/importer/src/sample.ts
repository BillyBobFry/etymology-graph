import { previewEntry, readJsonlSample } from "./wiktextract.js";

const inputPath = process.env.WIKTEXTRACT_PATH ?? "../../wikidata_downloads/raw-wiktextract-data.jsonl";
const sampleSize = Number(process.env.SAMPLE_SIZE ?? 5);

const entries = await readJsonlSample(inputPath, sampleSize);

for (const entry of entries) {
  const preview = previewEntry(entry);

  console.log({
    word: entry.word,
    lang: entry.lang,
    langCode: entry.lang_code,
    pos: entry.pos,
    etymologyNumber: entry.etymology_number,
    nodeCount: preview.nodes.length,
    edgeCount: preview.edges.length
  });
}
