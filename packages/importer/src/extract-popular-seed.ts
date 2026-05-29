import { loadPopularWordTargets } from "./popular-word-lists.js";
import { extractSeedEntries, parseSeedTargets } from "./wiktextract.js";

const inputPath = process.env.WIKTEXTRACT_PATH ?? "../../wikidata_downloads/raw-wiktextract-data.jsonl";
const defaultPopularWordsDirs = [
  "../../data/seed-words/thousand-most-common-words",
  "../../data/seed-words/corpora"
];
const popularWordsDirs = parsePopularWordsDirs(process.env.POPULAR_WORDS_DIRS);
const outputPath = process.env.SEED_OUTPUT_PATH ?? "../../wikidata_downloads/seeds/popular-seed.jsonl";
const limitPerTarget = Number(process.env.SEED_LIMIT_PER_TARGET ?? 1);

const popularTargets = await Promise.all(popularWordsDirs.map((directoryPath) => loadPopularWordTargets(directoryPath)));
const targetSpecs = [...new Set(popularTargets.flatMap((result) => result.targetSpecs))];
const targets = parseSeedTargets(targetSpecs.join(","));

if (targets.length === 0) {
  throw new Error(`Popular seed extraction found no targets in ${popularWordsDirs.join(", ")}`);
}

const result = await extractSeedEntries({
  inputPath,
  outputPath,
  targets,
  limitPerTarget
});

console.log({
  inputPath,
  popularWordsDirs,
  outputPath,
  targetCount: targets.length,
  files: popularTargets.flatMap((targetResult) => targetResult.files),
  result
});

/** Resolves one or more seed-word directories for popular extraction. */
function parsePopularWordsDirs(directorySpec: string | undefined): string[] {
  if (!directorySpec) {
    return defaultPopularWordsDirs;
  }

  return directorySpec
    .split(",")
    .map((directoryPath) => directoryPath.trim())
    .filter((directoryPath) => directoryPath.length > 0);
}
