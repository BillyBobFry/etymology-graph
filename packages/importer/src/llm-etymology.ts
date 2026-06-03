import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

import { readJsonlRecords, type WiktextractEntry } from "./wiktextract.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

type EtymologyPromptInput = {
  target: {
    langCode: string;
    language: string | undefined;
    word: string;
    pos: string | undefined;
    etymologyNumber: number | undefined;
  };
  glosses: string[];
  etymologyText: string;
  templateAnchors: TemplateAnchor[];
};

type TemplateAnchor = {
  name: string;
  args: string[];
  expansion: string | undefined;
};

type TargetSpec = {
  langCode: string;
  word: string;
};

const etymologyEdgeTypes = [
  "inherited_from",
  "derived_from",
  "borrowed_from",
  "compound_of",
  "affixed_from",
  "calque_of",
  "doublet_of",
  "cognate_with",
  "related_to"
] as const;

const confidenceLevels = ["high", "medium", "low"] as const;

const llmEtymologyResponseSchema = z.object({
  summary: z.string(),
  edges: z.array(
    z.object({
      from: z.object({
        langCode: z.string(),
        word: z.string()
      }),
      to: z.object({
        langCode: z.string(),
        word: z.string()
      }),
      type: z.enum(etymologyEdgeTypes),
      confidence: z.enum(confidenceLevels),
      uncertain: z.boolean(),
      evidenceText: z.string(),
      reasoning: z.string()
    })
  ),
  warnings: z.array(z.string())
});

const llmEtymologyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "edges", "warnings"],
  properties: {
    summary: { type: "string" },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "type", "confidence", "uncertain", "evidenceText", "reasoning"],
        properties: {
          from: {
            type: "object",
            additionalProperties: false,
            required: ["langCode", "word"],
            properties: {
              langCode: { type: "string" },
              word: { type: "string" }
            }
          },
          to: {
            type: "object",
            additionalProperties: false,
            required: ["langCode", "word"],
            properties: {
              langCode: { type: "string" },
              word: { type: "string" }
            }
          },
          type: { type: "string", enum: etymologyEdgeTypes },
          confidence: { type: "string", enum: confidenceLevels },
          uncertain: { type: "boolean" },
          evidenceText: { type: "string" },
          reasoning: { type: "string" }
        }
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

const inputPath =
  process.env.LLM_ETYMOLOGY_INPUT_PATH ?? "../../wikidata_downloads/seeds/structured-ancestry-seed.jsonl";
const target = parseTargetSpec(process.env.LLM_ETYMOLOGY_TARGET ?? "en:king");
const targetPos = process.env.LLM_ETYMOLOGY_POS;
const targetEtymologyNumber = process.env.LLM_ETYMOLOGY_ETYMOLOGY_NUMBER
  ? Number(process.env.LLM_ETYMOLOGY_ETYMOLOGY_NUMBER)
  : undefined;
const dryRun = process.env.LLM_ETYMOLOGY_DRY_RUN === "1" || process.env.LLM_ETYMOLOGY_DRY_RUN === "true";

const entry = await findTargetEntry(inputPath, target, targetPos, targetEtymologyNumber);
if (!entry) {
  throw new Error(`No matching entry found for ${target.langCode}:${target.word} in ${inputPath}`);
}

const promptInput = buildPromptInput(entry);
const messages = buildMessages(promptInput);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        model: 'gpt-5-nano',
        inputPath,
        target,
        targetPos,
        targetEtymologyNumber,
        messages
      },
      null,
      2
    )
  );
} else {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set in .env or the environment");
  }

  const client = new OpenAI({ apiKey });
  console.log(`sending message for ${target.langCode}:${target.word}`)
  const completion = await client.chat.completions.create({
    model: 'gpt-5-nano',
    messages,
    
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "etymology_graph_extraction",
        strict: true,
        schema: llmEtymologyJsonSchema
      }
    }
  });
  const content = completion.choices[0]?.message.content;
  console.log('response received')
  console.log(content)
  console.log(JSON.stringify(completion.usage, null, 2))
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsedResponse = llmEtymologyResponseSchema.parse(JSON.parse(content) as unknown);
  console.log(JSON.stringify(parsedResponse, null, 2));
}

/** Parses CLI target specs such as `en:king` while preserving colons inside the word. */
function parseTargetSpec(value: string): TargetSpec {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error("LLM_ETYMOLOGY_TARGET must use the form lang_code:word, for example en:king");
  }

  return {
    langCode: value.slice(0, separatorIndex),
    word: value.slice(separatorIndex + 1)
  };
}

/** Streams the seed file so large generated JSONL files do not have to fit in memory. */
async function findTargetEntry(
  path: string,
  targetSpec: TargetSpec,
  pos: string | undefined,
  etymologyNumber: number | undefined
): Promise<WiktextractEntry | undefined> {
  for await (const record of readJsonlRecords(path)) {
    const entry = record.entry;
    if (entry.lang_code !== targetSpec.langCode || entry.word !== targetSpec.word) {
      continue;
    }

    if (pos && entry.pos !== pos) {
      continue;
    }

    if (etymologyNumber !== undefined && entry.etymology_number !== etymologyNumber) {
      continue;
    }

    return entry;
  }

  return undefined;
}

/** Builds a compact payload that grounds the model without sending the full Wiktextract entry. */
function buildPromptInput(entry: WiktextractEntry): EtymologyPromptInput {
  return {
    target: {
      langCode: entry.lang_code ?? "",
      language: entry.lang,
      word: entry.word ?? "",
      pos: entry.pos,
      etymologyNumber: entry.etymology_number
    },
    glosses: extractGlosses(entry).slice(0, numberFromEnv("LLM_ETYMOLOGY_MAX_GLOSSES", 4)),
    etymologyText: entry.etymology_text ?? "",
    templateAnchors: extractTemplateAnchors(entry).slice(0, numberFromEnv("LLM_ETYMOLOGY_MAX_TEMPLATES", 48))
  };
}

/** Pulls only gloss strings because examples, quotations, and links are noisy for etymology parsing. */
function extractGlosses(entry: WiktextractEntry): string[] {
  return [
    ...new Set(
      (entry.senses ?? [])
        .flatMap((sense) => sense.glosses ?? sense.raw_glosses ?? [])
        .map((gloss) => gloss.trim())
        .filter((gloss) => gloss.length > 0)
    )
  ];
}

/** Keeps template anchors small: names and term arguments are useful, full template payloads are not. */
function extractTemplateAnchors(entry: WiktextractEntry): TemplateAnchor[] {
  return (entry.etymology_templates ?? []).flatMap((template) => {
    const name = template.name?.trim();
    if (!name || !templateLooksUsefulForEtymology(name)) {
      return [];
    }

    const args = template.args ?? {};
    return [
      {
        name,
        args: compactTemplateArgs(args),
        expansion: compactExpansion(template.expansion)
      }
    ];
  });
}

/** Filters out layout and cognate-list templates so prompt context stays focused on ancestry prose. */
function templateLooksUsefulForEtymology(name: string): boolean {
  if (process.env.LLM_ETYMOLOGY_INCLUDE_COGNATES === "1" && /^(?:cog|noncog)$/.test(name)) {
    return true;
  }

  return /^(?:etymon|root|inh\+?|der\+?|uder|bor\+?|lbor|borrowed|doublet|compound|af|prefix|suffix)$/.test(name);
}

/** Keeps only the first few positional args because they carry language and term anchors. */
function compactTemplateArgs(args: Record<string, string>): string[] {
  return ["1", "2", "3", "4", "5"].flatMap((key) => {
    const value = cleanOptional(args[key]);

    return value ? [value] : [];
  });
}

/** Trims rendered template text so the prompt has anchors without duplicating the whole prose. */
function compactExpansion(value: string | undefined): string | undefined {
  const expansion = cleanOptional(value);
  if (!expansion) {
    return undefined;
  }

  const compact = expansion.replace(/\s+/g, " ");
  return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
}

/** Builds the instruction pair used for both dry runs and OpenAI calls. */
function buildMessages(input: EtymologyPromptInput): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You extract etymology graph edges from Wiktionary/Wiktextract entries.",
        "Return only JSON matching the schema.",
        "Use source-directed edges: from the child/current term to its source or component term.",
        "Prefer the etymology prose for relationship structure, and use template anchors only to resolve language codes and spellings.",
        "Template anchors preserve Wiktionary positional args; for inheritance/borrowing/derivation templates, args are usually current language, source language, source term, display term.",
        "Do not invent terms that are not present in the prose or anchors.",
        "Mark uncertain, possible, maybe, perhaps, or alternative origins as uncertain with lower confidence.",
        "Do not include descendant lists, derived terms, example phrases, or unrelated cognate lists unless the prose explicitly says they are part of this word's etymology."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        "Extract the etymology graph for this entry.",
        "",
        "Current entry context:",
        JSON.stringify(input, null, 2),
        "",
        "Output guidance:",
        "- `from` should usually start at the current entry and then continue through intermediate sources when the prose states a chain.",
        "- If the prose says `from A, from B`, return edges current -> A and A -> B.",
        "- Use `inherited_from`, `borrowed_from`, or `derived_from` when the prose makes the relationship clear.",
        "- Use `compound_of` or `affixed_from` for same-language formations from components.",
        "- Use `warnings` for ambiguity, skipped prose, or places where language/term identity is unclear."
      ].join("\n")
    }
  ];
}

/** Reads positive integer env overrides while keeping script defaults simple. */
function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

/** Normalizes optional prompt fields so empty strings do not waste model context. */
function cleanOptional(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}
