import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

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
const wiktionaryEtymologyLanguageDataSource = {
  label: "etymology languages",
  url: "https://en.wiktionary.org/w/index.php?title=Module:etymology_languages/data&action=raw"
} as const;
const additionalLanguageMappings = [
] as const satisfies LanguageMapping[];
const userAgent = "etymology-graph-language-import/0.1 (local development)";
const databaseUrl = process.env.DATABASE_URL;

const mediaWikiParseResponseSchema = z.object({
  parse: z.object({
    text: z.string()
  })
});

type LanguageMapping = {
  code: string;
  canonicalName: string;
  source: "local" | "wiktionary" | "wiktionary-etymology";
};

type LanguageListSource = (typeof wiktionaryLanguageListSources)[number];
type EtymologyLanguageDataSource = typeof wiktionaryEtymologyLanguageDataSource;

type LanguageListPage = {
  source: LanguageListSource;
  html: string;
};

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

try {
  const [pages, etymologyLanguageData] = await Promise.all([
    fetchWiktionaryLanguageListPages(),
    fetchWiktionaryEtymologyLanguageData()
  ]);
  const languages = mergeLanguageMappings([
    ...pages.flatMap((page) => parseWiktionaryLanguageTable(page.html)),
    ...parseWiktionaryEtymologyLanguageData(etymologyLanguageData),
    ...additionalLanguageMappings
  ]);

  if (languages.length === 0) {
    throw new Error("Wiktionary language list parser found no language rows");
  }

  const client = await pool.connect();

  try {
    const importedCount = await upsertLanguageMappings(client, languages);
    console.log({
      importedCount,
      additionalMappingCount: additionalLanguageMappings.length,
      sources: [...wiktionaryLanguageListSources.map((source) => source.url), wiktionaryEtymologyLanguageDataSource.url]
    });
  } finally {
    client.release();
  }
} finally {
  await pool.end();
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

/** Fetches Wiktionary's raw etymology-language Lua table for variety and stage codes. */
async function fetchWiktionaryEtymologyLanguageData(): Promise<string> {
  return fetchWiktionaryRawSource(wiktionaryEtymologyLanguageDataSource);
}

/** Fetches one raw Wiktionary module source without rendering the page HTML. */
async function fetchWiktionaryRawSource(source: EtymologyLanguageDataSource): Promise<string> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Wiktionary ${source.label} source request failed with status ${response.status}`);
  }

  return response.text();
}

/** Extracts canonical language names from Wiktionary's generated language list tables. */
function parseWiktionaryLanguageTable(html: string): LanguageMapping[] {
  const languagesByCode = new Map<string, LanguageMapping>();
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const [, rowHtml] = rowMatch;
    const code = extractLanguageCode(rowHtml);
    const canonicalName = extractCanonicalName(rowHtml);

    if (!code || !canonicalName) {
      continue;
    }

    languagesByCode.set(code, {
      code,
      canonicalName,
      source: "wiktionary"
    });
  }

  return [...languagesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

/** Extracts language-variety display names from Wiktionary's etymology-language module. */
function parseWiktionaryEtymologyLanguageData(sourceText: string): LanguageMapping[] {
  const languagesByCode = new Map<string, LanguageMapping>();
  const entryPattern = /m\["([^"]+)"\]\s*=\s*{\s*"((?:\\.|[^"\\])*)"/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryPattern.exec(sourceText)) !== null) {
    const [, code, canonicalName] = entryMatch;

    if (!code || !canonicalName) {
      continue;
    }

    languagesByCode.set(code, {
      code,
      canonicalName: decodeLuaString(canonicalName),
      source: "wiktionary-etymology"
    });
  }

  return [...languagesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

/** Keeps one stable language display name per code after combining fetched and local mappings. */
function mergeLanguageMappings(languages: LanguageMapping[]): LanguageMapping[] {
  const languagesByCode = new Map<string, LanguageMapping>();

  for (const language of languages) {
    languagesByCode.set(language.code, language);
  }

  return [...languagesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

/** Reads the explicit code cell so row anchors cannot masquerade as language codes. */
function extractLanguageCode(rowHtml: string): string | undefined {
  const codeMatch = /<code\b(?=[^>]*\bclass="[^"]*\blanguage-code\b[^"]*")[^>]*>([\s\S]*?)<\/code>/.exec(rowHtml);

  return codeMatch ? stripHtml(codeMatch[1]) : undefined;
}

/** Reads the canonical-name cell, which is the second table cell in Wiktionary's language tables. */
function extractCanonicalName(rowHtml: string): string | undefined {
  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
  const canonicalNameCell = cells[1]?.[1];

  return canonicalNameCell ? stripHtml(canonicalNameCell) : undefined;
}

/** Decodes the small subset of Lua string escapes that can appear in quoted names. */
function decodeLuaString(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
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

/** Upserts language display names as reference data shared by API queries. */
async function upsertLanguageMappings(client: PoolClient, languages: LanguageMapping[]): Promise<number> {
  await client.query("BEGIN");

  try {
    for (const language of languages) {
      await client.query(
        `
          INSERT INTO languages (code, canonical_name, source, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (code) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        `,
        [language.code, language.canonicalName, language.source]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return languages.length;
}
