import { languageSeedCsvPath, readLanguageSeedCsv } from "./language-seed.js";

const inputPath = process.env.LANGUAGE_SEED_CSV_PATH ?? languageSeedCsvPath;
const result = await readLanguageSeedCsv(inputPath);

if (result.errors.length > 0) {
  console.error({
    inputPath,
    rowCount: result.rows.length,
    errorCount: result.errors.length,
    errors: result.errors.slice(0, 50)
  });
  process.exitCode = 1;
} else {
  console.log({
    inputPath,
    rowCount: result.rows.length,
    rowsWithDescriptions: result.rows.filter((row) => row.shortDescription).length
  });
}
