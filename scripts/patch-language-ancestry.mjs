import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const enrichedPath = fileURLToPath(new URL("../data/languages/languages.csv", import.meta.url));
const draftPath = fileURLToPath(new URL("../data/languages/languages-draft.csv", import.meta.url));
const ancestryColumnName = "ancestor_codes";
const codeColumnName = "code";

const enrichedCsv = await readFile(enrichedPath, "utf8");
const draftCsv = await readFile(draftPath, "utf8");
const enrichedTable = parseCsv(enrichedCsv);
const draftTable = parseCsv(draftCsv);
const [enrichedHeaders, ...enrichedRecords] = enrichedTable;
const [draftHeaders, ...draftRecords] = draftTable;

if (!enrichedHeaders || !draftHeaders) {
  throw new Error("Both language CSV files must contain headers");
}

const enrichedCodeIndex = requiredColumnIndex(enrichedHeaders, codeColumnName, enrichedPath);
const enrichedAncestryIndex = requiredColumnIndex(enrichedHeaders, ancestryColumnName, enrichedPath);
const draftCodeIndex = requiredColumnIndex(draftHeaders, codeColumnName, draftPath);
const draftAncestryIndex = requiredColumnIndex(draftHeaders, ancestryColumnName, draftPath);
const draftRecordsByCode = new Map(draftRecords.map((record) => [record[draftCodeIndex], record]));
const enrichedCodes = new Set(enrichedRecords.map((record) => record[enrichedCodeIndex]));
let patchedCount = 0;

for (const record of enrichedRecords) {
  const code = record[enrichedCodeIndex];
  const draftRecord = draftRecordsByCode.get(code);

  if (!draftRecord) {
    continue;
  }

  const nextAncestry = draftRecord[draftAncestryIndex] ?? "[]";

  if (record[enrichedAncestryIndex] !== nextAncestry) {
    record[enrichedAncestryIndex] = nextAncestry;
    patchedCount += 1;
  }
}

const missingDraftRecords = draftRecords.filter((record) => !enrichedCodes.has(record[draftCodeIndex]));
const appendedRecords = missingDraftRecords.map((draftRecord) =>
  enrichedHeaders.map((header) => {
    if (header === "id") {
      return "";
    }

    const draftIndex = draftHeaders.indexOf(header);

    return draftIndex === -1 ? "" : draftRecord[draftIndex] ?? "";
  })
);
const nextRows = [enrichedHeaders, ...enrichedRecords, ...appendedRecords];

await writeFile(enrichedPath, serializeCsv(nextRows), "utf8");

console.log({
  patchedCount,
  appendedCount: appendedRecords.length,
  rowCount: nextRows.length - 1,
  enrichedPath,
  draftPath
});

/** Finds a required CSV column and includes the source path in failures. */
function requiredColumnIndex(headers, columnName, path) {
  const index = headers.indexOf(columnName);

  if (index === -1) {
    throw new Error(`${path} is missing required column "${columnName}"`);
  }

  return index;
}

/** Parses standard quote-escaped CSV into a table of string cells. */
function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    field += character;
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Serializes rows with quote escaping only when a cell needs it. */
function serializeCsv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

/** Escapes one CSV cell with quotes only when the content requires it. */
function csvEscape(value) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
