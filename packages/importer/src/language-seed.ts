import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { PoolClient } from "pg";
import { z } from "zod";

export const languageSeedCsvPath = fileURLToPath(new URL("../../../data/languages/languages.csv", import.meta.url));

const wiktionaryBaseUrl = "https://en.wiktionary.org";
const userAgent = "etymology-graph-language-import/0.1 (local development)";
const missingDescriptionStatus = "missing";
const languageSeedHeaders = [
  "code",
  "canonical_name",
  "source",
  "wiktionary_url",
  "wikidata_id",
  "family_code",
  "family_name",
  "family_parent_code",
  "ancestor_codes",
  "script_codes",
  "short_description",
  "description_source_urls",
  "description_status",
  "description_model",
  "description_updated_at",
  "metadata"
] as const;
const wiktionaryLanguageListSources = [
  {
    label: "main",
    url: "https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&page=Wiktionary%3AList%20of%20languages&prop=text"
  },
  {
    label: "special",
    url: "https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&page=Wiktionary%3AList%20of%20languages%2Fspecial&prop=text"
  }
] as const;
const wiktionaryLanguageModuleTitles = [
  "Module:languages/data/2",
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((letter) => `Module:languages/data/3/${letter}`)
] as const;
const wiktionaryEtymologyLanguageModuleTitle = "Module:etymology_languages/data";
const wiktionaryFamilyModuleTitle = "Module:families/data";
const jsonStringArraySchema = z.string().array();
const rawCsvRowSchema = z.object(Object.fromEntries(languageSeedHeaders.map((header) => [header, z.string()]))).strict();
const mediaWikiParseResponseSchema = z.object({
  parse: z.object({
    text: z.string()
  })
});

type LanguageSeedHeader = (typeof languageSeedHeaders)[number];
type LanguageSource = "local" | "wiktionary" | "wiktionary-etymology";
type LanguageListSource = (typeof wiktionaryLanguageListSources)[number];

export type LanguageSeedRow = {
  code: string;
  canonicalName: string;
  source: LanguageSource;
  wiktionaryUrl: string;
  wikidataId: string;
  familyCode: string;
  familyName: string;
  familyParentCode: string;
  ancestorCodes: string[];
  scriptCodes: string[];
  shortDescription: string;
  descriptionSourceUrls: string[];
  descriptionStatus: string;
  descriptionModel: string;
  descriptionUpdatedAt: string;
  metadata: Record<string, unknown>;
};

type LanguageListRow = {
  code: string;
  canonicalName: string;
  wiktionaryUrl: string;
  source: LanguageSource;
};

type StructuredLanguageRow = {
  code: string;
  canonicalName: string;
  source: LanguageSource;
  wikidataId: string;
  familyCode: string;
  parentCode: string;
  ancestorCodes: string[];
  scriptCodes: string[];
};

type FamilyRow = {
  code: string;
  canonicalName: string;
  wikidataId: string;
  parentCode: string;
  protoLanguageCode: string;
};

type LuaEntry = {
  code: string;
  body: string;
};

type LanguageListPage = {
  source: LanguageListSource;
  html: string;
};

type ValidationResult = {
  rows: LanguageSeedRow[];
  errors: string[];
};

/** Builds the first-pass language seed from Wiktionary's rendered lists and structured Lua data modules. */
export async function generateLanguageSeedRows(): Promise<LanguageSeedRow[]> {
  const [languageListPages, standardLanguageSources, etymologyLanguageSource, familySource] = await Promise.all([
    fetchWiktionaryLanguageListPages(),
    Promise.all(wiktionaryLanguageModuleTitles.map(fetchWiktionaryRawModule)),
    fetchWiktionaryRawModule(wiktionaryEtymologyLanguageModuleTitle),
    fetchWiktionaryRawModule(wiktionaryFamilyModuleTitle)
  ]);
  const languageListRows = languageListPages.flatMap((page) => parseWiktionaryLanguageTable(page.html));
  const structuredLanguageRows = [
    ...standardLanguageSources.flatMap((source) => parseStructuredLanguageRows(source, "wiktionary")),
    ...parseStructuredLanguageRows(etymologyLanguageSource, "wiktionary-etymology")
  ];
  const familiesByCode = new Map(parseFamilyRows(familySource).map((family) => [family.code, family]));
  const parentCodeByLanguageCode = new Map(
    structuredLanguageRows.filter((row) => row.parentCode).map((row) => [row.code, row.parentCode])
  );

  return expandLanguageAncestorChains(
    mergeLanguageRows(languageListRows, structuredLanguageRows, familiesByCode),
    familiesByCode,
    parentCodeByLanguageCode
  );
}

/** Writes a language seed CSV with stable headers and deterministic row ordering. */
export async function writeLanguageSeedCsv(path: string, rows: LanguageSeedRow[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeLanguageSeedCsv(rows), "utf8");
}

/** Reads and validates the committed language seed CSV for import or review. */
export async function readLanguageSeedCsv(path: string): Promise<ValidationResult> {
  const csv = await readFile(path, "utf8");

  return parseLanguageSeedCsv(csv);
}

/** Carries manually authored description fields forward when machine-derived fields are refreshed. */
export function preserveLanguageSeedDescriptions(
  generatedRows: LanguageSeedRow[],
  existingRows: LanguageSeedRow[]
): LanguageSeedRow[] {
  const existingRowsByCode = new Map(existingRows.map((row) => [row.code, row]));

  return generatedRows.map((generatedRow) => {
    const existingRow = existingRowsByCode.get(generatedRow.code);

    if (!existingRow) {
      return generatedRow;
    }

    return {
      ...generatedRow,
      shortDescription: existingRow.shortDescription,
      descriptionSourceUrls: existingRow.descriptionSourceUrls,
      descriptionStatus: existingRow.descriptionStatus,
      descriptionModel: existingRow.descriptionModel,
      descriptionUpdatedAt: existingRow.descriptionUpdatedAt,
      metadata: existingRow.metadata
    };
  });
}

/** Upserts CSV-backed language metadata into Postgres as restorable reference data. */
export async function upsertLanguageSeedRows(client: PoolClient, rows: LanguageSeedRow[]): Promise<number> {
  await client.query("BEGIN");

  try {
    await client.query(
      `
        INSERT INTO languages (
          code,
          canonical_name,
          source,
          wiktionary_url,
          wikidata_id,
          family_code,
          family_name,
          family_parent_code,
          ancestor_codes,
          script_codes,
          short_description,
          description_source_urls,
          description_status,
          description_model,
          description_updated_at,
          metadata,
          updated_at
        )
        SELECT
          code,
          canonical_name,
          source,
          nullif(wiktionary_url, ''),
          nullif(wikidata_id, ''),
          nullif(family_code, ''),
          nullif(family_name, ''),
          nullif(family_parent_code, ''),
          ancestor_codes,
          script_codes,
          nullif(short_description, ''),
          description_source_urls,
          description_status,
          nullif(description_model, ''),
          nullif(description_updated_at, '')::timestamptz,
          metadata,
          now()
        FROM jsonb_to_recordset($1::jsonb) AS languages(
          code TEXT,
          canonical_name TEXT,
          source TEXT,
          wiktionary_url TEXT,
          wikidata_id TEXT,
          family_code TEXT,
          family_name TEXT,
          family_parent_code TEXT,
          ancestor_codes TEXT[],
          script_codes TEXT[],
          short_description TEXT,
          description_source_urls TEXT[],
          description_status TEXT,
          description_model TEXT,
          description_updated_at TEXT,
          metadata JSONB
        )
        ON CONFLICT (code) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          source = EXCLUDED.source,
          wiktionary_url = EXCLUDED.wiktionary_url,
          wikidata_id = EXCLUDED.wikidata_id,
          family_code = EXCLUDED.family_code,
          family_name = EXCLUDED.family_name,
          family_parent_code = EXCLUDED.family_parent_code,
          ancestor_codes = EXCLUDED.ancestor_codes,
          script_codes = EXCLUDED.script_codes,
          short_description = EXCLUDED.short_description,
          description_source_urls = EXCLUDED.description_source_urls,
          description_status = EXCLUDED.description_status,
          description_model = EXCLUDED.description_model,
          description_updated_at = EXCLUDED.description_updated_at,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `,
      [JSON.stringify(rows.map(toDatabasePayload))]
    );
    await client.query(
      `
        DELETE FROM languages
        WHERE code NOT IN (
          SELECT code
          FROM jsonb_to_recordset($1::jsonb) AS languages(code TEXT)
        )
      `,
      [JSON.stringify(rows.map((row) => ({ code: row.code })))]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return rows.length;
}

/** Fetches expanded Wiktionary pages so generated language tables are available to parse. */
async function fetchWiktionaryLanguageListPages(): Promise<LanguageListPage[]> {
  return Promise.all(
    wiktionaryLanguageListSources.map(async (source) => ({
      source,
      html: await fetchWiktionaryLanguageListHtml(source)
    }))
  );
}

/** Fetches one expanded Wiktionary language page through the MediaWiki parse API. */
async function fetchWiktionaryLanguageListHtml(source: LanguageListSource): Promise<string> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Wiktionary ${source.label} language list request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = mediaWikiParseResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error(`Wiktionary ${source.label} language list response did not match the expected shape`);
  }

  return parsedPayload.data.parse.text;
}

/** Fetches a raw Wiktionary Lua module with the same user agent used for list imports. */
async function fetchWiktionaryRawModule(title: string): Promise<string> {
  const url = `${wiktionaryBaseUrl}/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Wiktionary ${title} source request failed with status ${response.status}`);
  }

  return response.text();
}

/** Extracts canonical language names and language-page links from Wiktionary's generated tables. */
function parseWiktionaryLanguageTable(html: string): LanguageListRow[] {
  const languagesByCode = new Map<string, LanguageListRow>();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const [, rowHtml] = rowMatch;
    const code = extractLanguageCode(rowHtml);
    const canonicalNameCell = extractCanonicalNameCell(rowHtml);
    const canonicalName = canonicalNameCell ? stripHtml(canonicalNameCell) : undefined;

    if (!code || !canonicalName) {
      continue;
    }

    languagesByCode.set(code, {
      code,
      canonicalName,
      source: "wiktionary",
      wiktionaryUrl: canonicalNameCell ? extractFirstWikiUrl(canonicalNameCell) : ""
    });
  }

  return [...languagesByCode.values()].sort(compareByCode);
}

/** Extracts structured language facts from Wiktionary language and etymology-language Lua modules. */
function parseStructuredLanguageRows(sourceText: string, source: LanguageSource): StructuredLanguageRow[] {
  return extractLuaEntries(sourceText)
    .map((entry) => {
      const fields = splitLuaTopLevelFields(entry.body);
      const canonicalName = parseLuaStringValue(fields[0] ?? "");
      const wikidataId = parseWikidataId(fields[1] ?? "");
      const explicitAncestorCodes = parseLuaCodeList(readLuaNamedField(fields, "ancestors"));
      const etymologyParentCode = source === "wiktionary-etymology" ? parseLuaStringValue(fields[2] ?? "") : "";
      const ancestorCodes = explicitAncestorCodes;
      const familyCode =
        source === "wiktionary-etymology"
          ? parseLuaStringValue(readLuaNamedField(fields, "family"))
          : parseLuaStringValue(fields[2] ?? "");
      const scriptCodes = source === "wiktionary-etymology" ? [] : splitCodeList(parseLuaStringValue(fields[3] ?? ""));

      if (!canonicalName) {
        return undefined;
      }

      return {
        code: entry.code,
        canonicalName,
        source,
        wikidataId,
        familyCode,
        parentCode: etymologyParentCode,
        ancestorCodes,
        scriptCodes
      };
    })
    .filter((row): row is StructuredLanguageRow => row !== undefined)
    .sort(compareByCode);
}

/** Extracts Wiktionary family labels so language rows can denormalize the family path starter. */
function parseFamilyRows(sourceText: string): FamilyRow[] {
  return extractLuaEntries(sourceText)
    .map((entry) => {
      const fields = splitLuaTopLevelFields(entry.body);
      const canonicalName = parseLuaStringValue(fields[0] ?? "");

      if (!canonicalName) {
        return undefined;
      }

      return {
        code: entry.code,
        canonicalName,
        wikidataId: parseWikidataId(fields[1] ?? ""),
        parentCode: parseLuaStringValue(fields[2] ?? ""),
        protoLanguageCode: parseLuaStringValue(readLuaNamedField(fields, "protoLanguage"))
      };
    })
    .filter((row): row is FamilyRow => row !== undefined)
    .sort(compareByCode);
}

/** Combines list rows and structured facts into the canonical CSV rows. */
function mergeLanguageRows(
  languageListRows: LanguageListRow[],
  structuredLanguageRows: StructuredLanguageRow[],
  familiesByCode: Map<string, FamilyRow>
): LanguageSeedRow[] {
  const rowsByCode = new Map<string, LanguageSeedRow>();

  for (const language of languageListRows) {
    rowsByCode.set(language.code, {
      code: language.code,
      canonicalName: language.canonicalName,
      source: language.source,
      wiktionaryUrl: language.wiktionaryUrl,
      wikidataId: "",
      familyCode: "",
      familyName: "",
      familyParentCode: "",
      ancestorCodes: [],
      scriptCodes: [],
      shortDescription: "",
      descriptionSourceUrls: [],
      descriptionStatus: missingDescriptionStatus,
      descriptionModel: "",
      descriptionUpdatedAt: "",
      metadata: {}
    });
  }

  for (const language of structuredLanguageRows) {
    const family = language.familyCode ? familiesByCode.get(language.familyCode) : undefined;
    const existingRow = rowsByCode.get(language.code);
    rowsByCode.set(language.code, {
      code: language.code,
      canonicalName: existingRow?.canonicalName || language.canonicalName,
      source: existingRow?.source ?? language.source,
      wiktionaryUrl: existingRow?.wiktionaryUrl ?? "",
      wikidataId: language.wikidataId,
      familyCode: language.familyCode,
      familyName: family?.canonicalName ?? "",
      familyParentCode: family?.parentCode ?? "",
      ancestorCodes: language.ancestorCodes,
      scriptCodes: language.scriptCodes,
      shortDescription: existingRow?.shortDescription ?? "",
      descriptionSourceUrls: existingRow?.descriptionSourceUrls ?? [],
      descriptionStatus: existingRow?.descriptionStatus ?? missingDescriptionStatus,
      descriptionModel: existingRow?.descriptionModel ?? "",
      descriptionUpdatedAt: existingRow?.descriptionUpdatedAt ?? "",
      metadata: existingRow?.metadata ?? {}
    });
  }

  return [...rowsByCode.values()].sort(compareByCode);
}

/** Expands immediate module ancestors into ordered older-to-newer chains for language detail pages. */
function expandLanguageAncestorChains(
  rows: LanguageSeedRow[],
  familiesByCode: Map<string, FamilyRow>,
  parentCodeByLanguageCode: Map<string, string>
): LanguageSeedRow[] {
  const rowsByCode = new Map(rows.map((row) => [row.code, row]));
  const protoCodeByFamilyCode = new Map<string, string>();

  for (const row of rows) {
    if (row.familyCode && row.canonicalName.startsWith("Proto-")) {
      protoCodeByFamilyCode.set(row.familyCode, row.code);
    }
  }

  return rows
    .map((row) => ({
      ...row,
      ancestorCodes: resolveAncestorChain(
        row.code,
        rowsByCode,
        familiesByCode,
        protoCodeByFamilyCode,
        parentCodeByLanguageCode,
        new Set()
      )
    }))
    .sort(compareByCode);
}

/** Walks direct ancestors, family proto-languages, and parent-family proto-languages without cycles. */
function resolveAncestorChain(
  code: string,
  rowsByCode: Map<string, LanguageSeedRow>,
  familiesByCode: Map<string, FamilyRow>,
  protoCodeByFamilyCode: Map<string, string>,
  parentCodeByLanguageCode: Map<string, string>,
  seenCodes: Set<string>
): string[] {
  if (seenCodes.has(code)) {
    return [];
  }

  seenCodes.add(code);

  const row = rowsByCode.get(code);

  if (!row) {
    return [];
  }

  const immediateAncestorCodes = immediateAncestorCodesForRow(
    row,
    rowsByCode,
    familiesByCode,
    protoCodeByFamilyCode,
    parentCodeByLanguageCode
  );
  const chains = immediateAncestorCodes.flatMap((ancestorCode) =>
    resolveAncestorChain(
      ancestorCode,
      rowsByCode,
      familiesByCode,
      protoCodeByFamilyCode,
      parentCodeByLanguageCode,
      new Set(seenCodes)
    ).concat(ancestorCode)
  );

  return unique(chains.filter((ancestorCode) => ancestorCode !== code));
}

/** Chooses the best immediate ancestor signal available for one language row. */
function immediateAncestorCodesForRow(
  row: LanguageSeedRow,
  rowsByCode: Map<string, LanguageSeedRow>,
  familiesByCode: Map<string, FamilyRow>,
  protoCodeByFamilyCode: Map<string, string>,
  parentCodeByLanguageCode: Map<string, string>
): string[] {
  if (row.ancestorCodes.length > 0) {
    return row.ancestorCodes;
  }

  if (!row.familyCode) {
    const parentCode = parentCodeByLanguageCode.get(row.code);
    const parentRow = parentCode ? rowsByCode.get(parentCode) : undefined;
    const parentFamilyProtoCode = parentRow
      ? protoLanguageCodeForFamilyLineage(parentRow.familyCode, row.code, rowsByCode, familiesByCode, protoCodeByFamilyCode)
      : undefined;

    if (parentFamilyProtoCode) {
      return [parentFamilyProtoCode];
    }

    const impliedFamilyCode = row.code.endsWith("-pro") ? row.code.slice(0, -"-pro".length) : "";
    const impliedFamily = impliedFamilyCode ? familiesByCode.get(impliedFamilyCode) : undefined;
    const impliedParentProtoCode = impliedFamily?.parentCode ? `${impliedFamily.parentCode}-pro` : "";
    const prefixFamilyCode = row.code.includes("-") ? row.code.split("-")[0] : "";
    const prefixFamilyProtoCode = prefixFamilyCode ? `${prefixFamilyCode}-pro` : "";

    if (impliedParentProtoCode && rowsByCode.has(impliedParentProtoCode)) {
      return [impliedParentProtoCode];
    }

    return prefixFamilyProtoCode && prefixFamilyProtoCode !== row.code && rowsByCode.has(prefixFamilyProtoCode)
      ? [prefixFamilyProtoCode]
      : [];
  }

  const family = familiesByCode.get(row.familyCode);

  if (family?.protoLanguageCode && family.protoLanguageCode !== row.code) {
    return [family.protoLanguageCode];
  }

  const lineageProtoCode = protoLanguageCodeForFamilyLineage(
    row.familyCode,
    row.code,
    rowsByCode,
    familiesByCode,
    protoCodeByFamilyCode
  );

  if (lineageProtoCode) {
    return [lineageProtoCode];
  }

  const familyProtoCode = protoCodeByFamilyCode.get(row.familyCode);

  if (familyProtoCode && familyProtoCode !== row.code) {
    return [familyProtoCode];
  }

  const parentFamilyProtoCode = family?.parentCode ? protoCodeByFamilyCode.get(family.parentCode) : undefined;

  if (parentFamilyProtoCode && parentFamilyProtoCode !== row.code) {
    return [parentFamilyProtoCode];
  }

  const impliedParentProtoCode = family?.parentCode ? `${family.parentCode}-pro` : "";

  return impliedParentProtoCode && impliedParentProtoCode !== row.code && rowsByCode.has(impliedParentProtoCode)
    ? [impliedParentProtoCode]
    : [];
}

/** Climbs parent families until it finds the proto-language Wiktionary uses as the previous stage. */
function protoLanguageCodeForFamilyLineage(
  familyCode: string,
  excludedCode: string,
  rowsByCode: Map<string, LanguageSeedRow>,
  familiesByCode: Map<string, FamilyRow>,
  protoCodeByFamilyCode: Map<string, string>
): string | undefined {
  let currentFamilyCode = familyCode;
  const seenFamilyCodes = new Set<string>();

  while (currentFamilyCode && !seenFamilyCodes.has(currentFamilyCode)) {
    seenFamilyCodes.add(currentFamilyCode);

    const family = familiesByCode.get(currentFamilyCode);
    const explicitProtoCode = family?.protoLanguageCode;

    if (explicitProtoCode && explicitProtoCode !== excludedCode) {
      return explicitProtoCode;
    }

    const generatedProtoCode = protoCodeByFamilyCode.get(currentFamilyCode);

    if (generatedProtoCode && generatedProtoCode !== excludedCode) {
      return generatedProtoCode;
    }

    const impliedProtoCode = `${currentFamilyCode}-pro`;

    if (impliedProtoCode !== excludedCode && rowsByCode.has(impliedProtoCode)) {
      return impliedProtoCode;
    }

    currentFamilyCode = family?.parentCode ?? "";
  }

  return undefined;
}

/** Serializes seed rows to RFC-4180-style CSV with JSON strings for arrays and metadata. */
function serializeLanguageSeedCsv(rows: LanguageSeedRow[]): string {
  const lines = [
    languageSeedHeaders.join(","),
    ...rows.map((row) => languageSeedHeaders.map((header) => csvEscape(toCsvField(row, header))).join(","))
  ];

  return `${lines.join("\n")}\n`;
}

/** Parses and validates CSV content while collecting all row-level problems for easy pasted-file review. */
function parseLanguageSeedCsv(csv: string): ValidationResult {
  const table = parseCsv(csv);
  const [headers, ...records] = table;
  const errors: string[] = [];
  const rows: LanguageSeedRow[] = [];

  if (!headers) {
    return {
      rows,
      errors: ["CSV is empty"]
    };
  }

  const expectedHeaders = [...languageSeedHeaders];
  const acceptedHeaders = headers[0] === "id" ? headers.slice(1) : headers;

  if (acceptedHeaders.join(",") !== expectedHeaders.join(",")) {
    errors.push(`CSV headers must be exactly: ${expectedHeaders.join(",")} with an optional leading id column`);
  }

  const seenCodes = new Set<string>();
  const columnIndexByHeader = new Map(headers.map((header, index) => [header, index]));

  records.forEach((record, recordIndex) => {
    const rowNumber = recordIndex + 2;
    const rawRow = Object.fromEntries(
      expectedHeaders.map((header) => [header, record[columnIndexByHeader.get(header) ?? -1] ?? ""])
    );
    const parsedRawRow = rawCsvRowSchema.safeParse(rawRow);

    if (!parsedRawRow.success) {
      errors.push(`Row ${rowNumber} has invalid columns: ${parsedRawRow.error.issues.map((issue) => issue.message).join("; ")}`);
      return;
    }

    const row = parseRawLanguageSeedRow(parsedRawRow.data, rowNumber, errors);

    if (seenCodes.has(row.code)) {
      errors.push(`Row ${rowNumber} duplicates language code "${row.code}"`);
    }

    seenCodes.add(row.code);
    rows.push(row);
  });

  return {
    rows,
    errors
  };
}

/** Converts a raw string-only CSV row into typed seed data with strict JSON-array fields. */
function parseRawLanguageSeedRow(
  row: Record<LanguageSeedHeader, string>,
  rowNumber: number,
  errors: string[]
): LanguageSeedRow {
  const ancestorCodes = parseJsonStringArray(row.ancestor_codes, rowNumber, "ancestor_codes", errors);
  const scriptCodes = parseJsonStringArray(row.script_codes, rowNumber, "script_codes", errors);
  const descriptionSourceUrls = parseJsonStringArray(
    row.description_source_urls,
    rowNumber,
    "description_source_urls",
    errors
  );
  const metadata = parseJsonObject(row.metadata, rowNumber, "metadata", errors);

  if (!row.code.trim()) {
    errors.push(`Row ${rowNumber} is missing code`);
  }

  if (!row.canonical_name.trim()) {
    errors.push(`Row ${rowNumber} is missing canonical_name`);
  }

  if (!["local", "wiktionary", "wiktionary-etymology"].includes(row.source)) {
    errors.push(`Row ${rowNumber} has unsupported source "${row.source}"`);
  }

  if (row.short_description.length > 420) {
    errors.push(`Row ${rowNumber} short_description is longer than 420 characters`);
  }

  if (row.description_updated_at && Number.isNaN(Date.parse(row.description_updated_at))) {
    errors.push(`Row ${rowNumber} has invalid description_updated_at "${row.description_updated_at}"`);
  }

  return {
    code: row.code.trim(),
    canonicalName: row.canonical_name.trim(),
    source: parseLanguageSource(row.source),
    wiktionaryUrl: row.wiktionary_url.trim(),
    wikidataId: row.wikidata_id.trim(),
    familyCode: row.family_code.trim(),
    familyName: row.family_name.trim(),
    familyParentCode: row.family_parent_code.trim(),
    ancestorCodes,
    scriptCodes,
    shortDescription: row.short_description.trim(),
    descriptionSourceUrls,
    descriptionStatus: row.description_status.trim() || missingDescriptionStatus,
    descriptionModel: row.description_model.trim(),
    descriptionUpdatedAt: row.description_updated_at.trim(),
    metadata
  };
}

/** Converts a seed row into the snake-case payload expected by jsonb_to_recordset. */
function toDatabasePayload(row: LanguageSeedRow): Record<string, unknown> {
  return {
    code: row.code,
    canonical_name: row.canonicalName,
    source: row.source,
    wiktionary_url: row.wiktionaryUrl,
    wikidata_id: row.wikidataId,
    family_code: row.familyCode,
    family_name: row.familyName,
    family_parent_code: row.familyParentCode,
    ancestor_codes: row.ancestorCodes,
    script_codes: row.scriptCodes,
    short_description: row.shortDescription,
    description_source_urls: row.descriptionSourceUrls,
    description_status: row.descriptionStatus,
    description_model: row.descriptionModel,
    description_updated_at: row.descriptionUpdatedAt,
    metadata: row.metadata
  };
}

/** Reads the explicit code cell so row anchors cannot masquerade as language codes. */
function extractLanguageCode(rowHtml: string): string | undefined {
  const codeMatch = /<code\b(?=[^>]*\bclass="[^"]*\blanguage-code\b[^"]*")[^>]*>([\s\S]*?)<\/code>/.exec(rowHtml);

  return codeMatch ? stripHtml(codeMatch[1]) : undefined;
}

/** Reads the canonical-name cell, which is the second table cell in Wiktionary's language tables. */
function extractCanonicalNameCell(rowHtml: string): string | undefined {
  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];

  return cells[1]?.[1];
}

/** Extracts the first local wiki link from a canonical-name cell for source navigation. */
function extractFirstWikiUrl(html: string): string {
  const hrefMatch = /<a\b[^>]*\bhref="([^"]+)"/.exec(html);
  const href = hrefMatch ? decodeHtml(hrefMatch[1]) : "";

  if (!href || href.startsWith("#")) {
    return "";
  }

  if (href.startsWith("/wiki/")) {
    return `${wiktionaryBaseUrl}${href}`;
  }

  return href.startsWith("http://") || href.startsWith("https://") ? href : "";
}

/** Converts simple HTML fragments into stable text for database display fields. */
function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
}

/** Decodes entities that commonly appear in Wiktionary-generated table text. */
function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, entityBody: string) => {
    if (entityBody.startsWith("#x") || entityBody.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entityBody.slice(2), 16));
    }

    if (entityBody.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entityBody.slice(1), 10));
    }

    switch (entityBody) {
      case "amp":
        return "&";
      case "apos":
        return "'";
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "nbsp":
        return " ";
      case "quot":
        return '"';
      default:
        return entity;
    }
  });
}

/** Finds every m["code"] Lua table entry and returns its top-level body for field parsing. */
function extractLuaEntries(sourceText: string): LuaEntry[] {
  const entries: LuaEntry[] = [];
  const entryPattern = /m\["([^"]+)"\]\s*=\s*\{/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryPattern.exec(sourceText)) !== null) {
    const [, code] = entryMatch;
    const openingBraceIndex = entryPattern.lastIndex - 1;
    const closingBraceIndex = findMatchingBrace(sourceText, openingBraceIndex);

    if (closingBraceIndex === -1) {
      continue;
    }

    entries.push({
      code,
      body: sourceText.slice(openingBraceIndex + 1, closingBraceIndex)
    });
    entryPattern.lastIndex = closingBraceIndex + 1;
  }

  return entries;
}

/** Locates a Lua table's closing brace while respecting nested tables, strings, and comments. */
function findMatchingBrace(sourceText: string, openingBraceIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inLineComment = false;

  for (let index = openingBraceIndex; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];

    if (inLineComment) {
      if (character === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/** Splits a Lua table body into comma-delimited top-level fields without entering nested tables. */
function splitLuaTopLevelFields(body: string): string[] {
  const fields: string[] = [];
  let startIndex = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inLineComment = false;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    const nextCharacter = body[index + 1];

    if (inLineComment) {
      if (character === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      continue;
    }

    if (character === "," && depth === 0) {
      fields.push(body.slice(startIndex, index).trim());
      startIndex = index + 1;
    }
  }

  const finalField = body.slice(startIndex).trim();

  if (finalField) {
    fields.push(finalField);
  }

  return fields.filter((field) => field.length > 0);
}

/** Finds a named Lua table field from the already split top-level field list. */
function readLuaNamedField(fields: string[], fieldName: string): string {
  const assignmentPrefix = `${fieldName} =`;
  const assignment = fields.find((field) => field.startsWith(assignmentPrefix));

  return assignment ? assignment.slice(assignmentPrefix.length).trim() : "";
}

/** Parses a Lua quoted string and decodes the small escape subset used in Wiktionary modules. */
function parseLuaStringValue(value: string): string {
  const stringMatch = /^"((?:\\.|[^"\\])*)"/.exec(value.trim());

  return stringMatch ? decodeLuaString(stringMatch[1]) : "";
}

/** Converts numeric Wikidata IDs in Lua modules into canonical Q identifiers. */
function parseWikidataId(value: string): string {
  const trimmedValue = value.trim();

  return /^\d+$/.test(trimmedValue) ? `Q${trimmedValue}` : "";
}

/** Parses either a Lua string or a Lua string array into a list of language/family/script codes. */
function parseLuaCodeList(value: string): string[] {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  if (trimmedValue.startsWith("{")) {
    return [...trimmedValue.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) => decodeLuaString(match[1])).filter(Boolean);
  }

  return splitCodeList(parseLuaStringValue(trimmedValue));
}

/** Splits comma-delimited code lists while trimming the Wiktionary formatting whitespace. */
function splitCodeList(value: string): string[] {
  return value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

/** Decodes the small subset of Lua string escapes that can appear in quoted names. */
function decodeLuaString(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

/** Produces a CSV field value from a typed seed row. */
function toCsvField(row: LanguageSeedRow, header: LanguageSeedHeader): string {
  switch (header) {
    case "code":
      return row.code;
    case "canonical_name":
      return row.canonicalName;
    case "source":
      return row.source;
    case "wiktionary_url":
      return row.wiktionaryUrl;
    case "wikidata_id":
      return row.wikidataId;
    case "family_code":
      return row.familyCode;
    case "family_name":
      return row.familyName;
    case "family_parent_code":
      return row.familyParentCode;
    case "ancestor_codes":
      return JSON.stringify(row.ancestorCodes);
    case "script_codes":
      return JSON.stringify(row.scriptCodes);
    case "short_description":
      return row.shortDescription;
    case "description_source_urls":
      return JSON.stringify(row.descriptionSourceUrls);
    case "description_status":
      return row.descriptionStatus;
    case "description_model":
      return row.descriptionModel;
    case "description_updated_at":
      return row.descriptionUpdatedAt;
    case "metadata":
      return JSON.stringify(row.metadata);
  }
}

/** Escapes one CSV cell with quotes only when the content requires it. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Parses CSV content generated by this module and pasted offline edits with standard quote escaping. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

/** Parses a JSON-encoded string array cell and reports paste mistakes with row context. */
function parseJsonStringArray(value: string, rowNumber: number, fieldName: string, errors: string[]): string[] {
  try {
    const parsedValue: unknown = JSON.parse(value || "[]");
    const result = jsonStringArraySchema.safeParse(parsedValue);

    if (!result.success) {
      errors.push(`Row ${rowNumber} ${fieldName} must be a JSON string array`);
      return [];
    }

    return result.data;
  } catch {
    errors.push(`Row ${rowNumber} ${fieldName} is not valid JSON`);
    return [];
  }
}

/** Parses a JSON object metadata cell while keeping validation errors non-fatal for full-file review. */
function parseJsonObject(
  value: string,
  rowNumber: number,
  fieldName: string,
  errors: string[]
): Record<string, unknown> {
  try {
    const parsedValue: unknown = JSON.parse(value || "{}");

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      errors.push(`Row ${rowNumber} ${fieldName} must be a JSON object`);
      return {};
    }

    return parsedValue as Record<string, unknown>;
  } catch {
    errors.push(`Row ${rowNumber} ${fieldName} is not valid JSON`);
    return {};
  }
}

/** Narrows CSV source strings after validation has already reported unsupported values. */
function parseLanguageSource(value: string): LanguageSource {
  switch (value) {
    case "local":
    case "wiktionary":
    case "wiktionary-etymology":
      return value;
    default:
      return "local";
  }
}

/** Keeps seed output stable across fetches and local editing cycles. */
function compareByCode(left: { code: string }, right: { code: string }): number {
  return left.code.localeCompare(right.code);
}

/** Deduplicates while preserving source order for displayed ancestor chains. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}
