import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool } from "pg";

import {
  generateLanguageSeedRows,
  languageSeedCsvPath,
  preserveLanguageSeedDescriptions,
  readLanguageSeedCsv,
  writeLanguageSeedCsv,
  type LanguageSeedRow
} from "./language-seed.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;
const outputPath = process.env.LANGUAGE_SEED_CSV_PATH ?? languageSeedCsvPath;
const seedScope = parseSeedScope(process.env.LANGUAGE_SEED_SCOPE);
const generatedRows = await generateLanguageSeedRows();
const scopedRows = seedScope === "graph" ? await filterRowsToGraphLanguages(generatedRows) : generatedRows;
const existingRows = await readExistingRows(outputPath);
const rows = preserveLanguageSeedDescriptions(scopedRows, existingRows);

await writeLanguageSeedCsv(outputPath, rows);

console.log({
  outputPath,
  seedScope,
  fetchedRowCount: generatedRows.length,
  rowCount: rows.length,
  rowsWithWiktionaryUrl: rows.filter((row) => row.wiktionaryUrl).length,
  rowsWithWikidataId: rows.filter((row) => row.wikidataId).length,
  rowsWithFamily: rows.filter((row) => row.familyCode).length,
  rowsWithAncestors: rows.filter((row) => row.ancestorCodes.length > 0).length,
  rowsWithScripts: rows.filter((row) => row.scriptCodes.length > 0).length
});

type LanguageSeedScope = "all" | "graph";

type GraphLanguageCodeRow = {
  code: string;
};

/** Parses the generation scope, defaulting to app-visible graph languages. */
function parseSeedScope(value: string | undefined): LanguageSeedScope {
  switch (value) {
    case undefined:
    case "":
    case "graph":
      return "graph";
    case "all":
      return "all";
    default:
      throw new Error(`LANGUAGE_SEED_SCOPE must be "graph" or "all", received "${value}"`);
  }
}

/** Keeps the committed seed focused on graph languages plus the ancestors needed to explain them. */
async function filterRowsToGraphLanguages(rows: LanguageSeedRow[]): Promise<LanguageSeedRow[]> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set to generate the graph-scoped language seed");
  }

  const pool = new Pool({
    connectionString: databaseUrl
  });

  try {
    const result = await pool.query<GraphLanguageCodeRow>(`
      SELECT DISTINCT languages.code
      FROM languages
      JOIN graph_nodes ON graph_nodes.lang_code = languages.code
      ORDER BY languages.code
    `);
    const rowsByCode = new Map(rows.map((row) => [row.code, row]));
    const scopedCodes = new Set(result.rows.map((row) => row.code));

    for (const code of [...scopedCodes]) {
      const row = rowsByCode.get(code);

      if (!row) {
        continue;
      }

      for (const ancestorCode of row.ancestorCodes) {
        scopedCodes.add(ancestorCode);
      }
    }

    const scopedRows = rows.filter((row) => scopedCodes.has(row.code));
    const scopedRowCodes = new Set(scopedRows.map((row) => row.code));
    const missingCodes = [...scopedCodes].filter((code) => !scopedRowCodes.has(code));

    if (missingCodes.length > 0) {
      console.warn({
        message: "Some graph or ancestor language codes were not present in the generated Wiktionary seed",
        missingCodeCount: missingCodes.length,
        missingCodes: missingCodes.slice(0, 50)
      });
    }

    return scopedRows;
  } finally {
    await pool.end();
  }
}

/** Reads the current CSV when present so offline description edits survive regeneration. */
async function readExistingRows(path: string): Promise<LanguageSeedRow[]> {
  try {
    await access(path);
  } catch {
    return [];
  }

  const result = await readLanguageSeedCsv(path);

  if (result.errors.length > 0) {
    throw new Error(`Existing language seed CSV is invalid:\n${result.errors.join("\n")}`);
  }

  return result.rows;
}
