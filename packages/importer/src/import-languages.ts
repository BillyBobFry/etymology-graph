import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const wiktionaryLanguageListUrl =
  "https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&page=Wiktionary%3AList%20of%20languages&prop=text";
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
};

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in .env or the environment");
}

const pool = new Pool({
  connectionString: databaseUrl
});

try {
  const html = await fetchWiktionaryLanguageListHtml();
  const languages = parseWiktionaryLanguageTable(html);

  if (languages.length === 0) {
    throw new Error("Wiktionary language list parser found no language rows");
  }

  const client = await pool.connect();

  try {
    const importedCount = await upsertLanguageMappings(client, languages);
    console.log({
      importedCount,
      source: wiktionaryLanguageListUrl
    });
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

/** Fetches the expanded Wiktionary page so generated language tables are available to parse. */
async function fetchWiktionaryLanguageListHtml(): Promise<string> {
  const response = await fetch(wiktionaryLanguageListUrl, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Wiktionary language list request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedPayload = mediaWikiParseResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Wiktionary language list response did not match the expected shape");
  }

  return parsedPayload.data.parse.text;
}

/** Extracts canonical language names from Wiktionary's generated language list tables. */
function parseWiktionaryLanguageTable(html: string): LanguageMapping[] {
  const languagesByCode = new Map<string, LanguageMapping>();
  const rowPattern = /<tr id="([^"]+)">([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const [, rowId, rowHtml] = rowMatch;
    const code = extractLanguageCode(rowHtml) ?? decodeHtml(rowId);
    const canonicalName = extractCanonicalName(rowHtml);

    if (!code || !canonicalName) {
      continue;
    }

    languagesByCode.set(code, {
      code,
      canonicalName
    });
  }

  return [...languagesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

/** Reads the explicit code cell so row anchors cannot masquerade as language codes. */
function extractLanguageCode(rowHtml: string): string | undefined {
  const codeMatch = /<code class="language-code">([\s\S]*?)<\/code>/.exec(rowHtml);

  return codeMatch ? stripHtml(codeMatch[1]) : undefined;
}

/** Reads the canonical-name cell, which is the second table cell in Wiktionary's language tables. */
function extractCanonicalName(rowHtml: string): string | undefined {
  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
  const canonicalNameCell = cells[1]?.[1];

  return canonicalNameCell ? stripHtml(canonicalNameCell) : undefined;
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
          VALUES ($1, $2, 'wiktionary', now())
          ON CONFLICT (code) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        `,
        [language.code, language.canonicalName]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return languages.length;
}
