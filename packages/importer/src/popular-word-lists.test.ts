import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadPopularWordTargets } from "./popular-word-lists.js";

/** Creates an isolated seed-list directory so loader tests do not depend on committed data files. */
async function withSeedDirectory<T>(runTest: (directoryPath: string) => Promise<T>): Promise<T> {
  const directoryPath = await mkdtemp(join(tmpdir(), "etymology-seeds-"));

  try {
    return await runTest(directoryPath);
  } finally {
    await rm(directoryPath, { recursive: true, force: true });
  }
}

describe("loadPopularWordTargets", () => {
  it("loads explicit language word lists", async () => {
    await withSeedDirectory(async (directoryPath) => {
      await writeFile(
        join(directoryPath, "common-words.json"),
        JSON.stringify({
          languageCode: "en",
          words: [" alligator ", " pepper "]
        })
      );

      const result = await loadPopularWordTargets(directoryPath);

      expect(result.targetSpecs).toEqual(["en:alligator", "en:pepper"]);
      expect(result.files).toEqual([
        {
          path: join(directoryPath, "common-words.json"),
          languageCode: "en",
          wordCount: 2
        }
      ]);
    });
  });

  it("loads concept seed lists with per-language terms", async () => {
    await withSeedDirectory(async (directoryPath) => {
      await writeFile(
        join(directoryPath, "concepts.json"),
        JSON.stringify({
          source: {
            name: "test concepts"
          },
          concepts: [
            {
              id: "alligator",
              categories: ["animals/common"],
              languages: {
                en: ["alligator"],
                fr: [" alligator ", ""],
                de: ["Alligator"]
              }
            }
          ]
        })
      );

      const result = await loadPopularWordTargets(directoryPath);

      expect(result.targetSpecs).toEqual(["en:alligator", "fr:alligator", "de:Alligator"]);
      expect(result.files).toEqual([
        {
          path: join(directoryPath, "concepts.json"),
          languageCode: "de",
          wordCount: 1,
          source: "test concepts"
        },
        {
          path: join(directoryPath, "concepts.json"),
          languageCode: "en",
          wordCount: 1,
          source: "test concepts"
        },
        {
          path: join(directoryPath, "concepts.json"),
          languageCode: "fr",
          wordCount: 1,
          source: "test concepts"
        }
      ]);
    });
  });

  it("filters seed targets through a directory exclusion list", async () => {
    await withSeedDirectory(async (directoryPath) => {
      await writeFile(join(directoryPath, "exclusions.json"), JSON.stringify(["alligator", "pepper"]));
      await writeFile(
        join(directoryPath, "concepts.json"),
        JSON.stringify({
          concepts: [
            {
              id: "alligator",
              languages: {
                en: ["alligator"],
                fr: ["alligator"]
              }
            },
            {
              id: "pepper",
              languages: {
                en: ["pepper"]
              }
            },
            {
              id: "bear",
              languages: {
                en: ["bear"]
              }
            }
          ]
        })
      );

      const result = await loadPopularWordTargets(directoryPath);

      expect(result.targetSpecs).toEqual(["en:bear"]);
      expect(result.files).toEqual([
        {
          path: join(directoryPath, "concepts.json"),
          languageCode: "en",
          wordCount: 1
        }
      ]);
    });
  });
});
