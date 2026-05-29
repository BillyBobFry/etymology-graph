import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { z } from "zod";

import { dedupeTargetSpecs } from "./seed-profiles.js";

const popularWordSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1).optional(),
  upstreamSource: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  retrievedAt: z.string().min(1).optional(),
  notes: z.string().min(1).optional()
});
const exclusionsFileName = "exclusions.json";
const excludedWordListSchema = z.array(z.string());

const languageWordListSchema = z.object({
  languageCode: z.string().min(1),
  languageName: z.string().min(1).optional(),
  languageNativeName: z.string().min(1).optional(),
  source: z.union([z.string().min(1), popularWordSourceSchema]).optional(),
  words: z.array(z.string())
});
const conceptWordListSchema = z.object({
  source: z.union([z.string().min(1), popularWordSourceSchema]).optional(),
  concepts: z.array(
    z.object({
      id: z.string().min(1),
      categories: z.array(z.string().min(1)).optional(),
      languages: z.record(z.string().min(1), z.array(z.string()))
    })
  )
});
const popularWordListSchema = z.union([languageWordListSchema, conceptWordListSchema]);

type LanguageWordList = z.infer<typeof languageWordListSchema>;
type PopularWordList = z.infer<typeof popularWordListSchema>;
type PopularWordTarget = {
  languageCode: string;
  word: string;
};

export type PopularWordListFileSummary = {
  path: string;
  languageCode: string;
  wordCount: number;
  source?: string;
};

export type PopularWordTargetsResult = {
  targetSpecs: string[];
  files: PopularWordListFileSummary[];
};

/** Loads local frequency lists as seed target specs without baking large word arrays into source. */
export async function loadPopularWordTargets(directoryPath: string): Promise<PopularWordTargetsResult> {
  const excludedWords = await loadExcludedWords(directoryPath);
  const fileNames = (await readdir(directoryPath))
    .filter((fileName) => extname(fileName) === ".json" && fileName !== "manifest.json" && fileName !== exclusionsFileName)
    .sort();
  const files: PopularWordListFileSummary[] = [];
  const targetSpecs: string[] = [];

  for (const fileName of fileNames) {
    const filePath = join(directoryPath, fileName);
    const parsedList = popularWordListSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
    const targets = readTargets(parsedList, excludedWords);

    files.push(...summarizeFileTargets(filePath, targets, readSource(parsedList)));
    targetSpecs.push(...targets.map(({ languageCode, word }) => `${languageCode}:${word}`));
  }

  return {
    targetSpecs: dedupeTargetSpecs(targetSpecs),
    files
  };
}

/** Reads seed targets from either language word lists or concept-language seed files. */
function readTargets(
  list: PopularWordList,
  excludedWords: ReadonlySet<string>
): PopularWordTarget[] {
  if ("concepts" in list) {
    return list.concepts.filter((concept) => !excludedWords.has(normalizeExcludedWord(concept.id))).flatMap((concept) =>
      Object.entries(concept.languages).flatMap(([languageCode, words]) =>
        words.map((word) => ({
          languageCode: languageCode.trim(),
          word: word.trim()
        }))
      )
    ).filter((target) => target.languageCode.length > 0 && target.word.length > 0);
  }

  return readWords(list).map((word) => ({
    languageCode: list.languageCode,
    word
  })).filter((target) => !excludedWords.has(normalizeExcludedWord(target.word)));
}

/** Reads explicitly language-scoped lists used by committed frequency data. */
function readWords(list: LanguageWordList): string[] {
  return list.words.map((word) => word.trim()).filter((word) => word.length > 0);
}

/** Reads optional provenance for reporting and debugging generated popular seeds. */
function readSource(list: PopularWordList): string | undefined {
  if (!list.source) {
    return undefined;
  }

  return typeof list.source === "string" ? list.source : list.source.name;
}

/** Reports one summary row per language when a seed file contains multilingual concepts. */
function summarizeFileTargets(
  filePath: string,
  targets: PopularWordTarget[],
  source: string | undefined
): PopularWordListFileSummary[] {
  const countsByLanguage = new Map<string, number>();

  for (const target of targets) {
    countsByLanguage.set(target.languageCode, (countsByLanguage.get(target.languageCode) ?? 0) + 1);
  }

  return [...countsByLanguage.entries()]
    .sort(([leftLanguageCode], [rightLanguageCode]) => leftLanguageCode.localeCompare(rightLanguageCode))
    .map(([languageCode, wordCount]) => ({
      path: filePath,
      languageCode,
      wordCount,
      source
    }));
}

/** Loads an optional per-directory denylist used to make seed curation reproducible. */
async function loadExcludedWords(directoryPath: string): Promise<ReadonlySet<string>> {
  try {
    const rawExclusions = JSON.parse(await readFile(join(directoryPath, exclusionsFileName), "utf8"));
    const excludedWords = excludedWordListSchema.parse(rawExclusions);

    return new Set(excludedWords.map(normalizeExcludedWord).filter((word) => word.length > 0));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Set();
    }

    throw error;
  }
}

/** Keeps curation list matching stable across casing and incidental whitespace. */
function normalizeExcludedWord(word: string): string {
  return word.trim().toLocaleLowerCase();
}
