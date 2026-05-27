import { dedupeTargetSpecs, resolveSeedProfiles } from "./seed-profiles.js";
import { extractSeedEntries, parseSeedTargets } from "./wiktextract.js";

const inputPath = process.env.WIKTEXTRACT_PATH ?? "../../wikidata_downloads/raw-wiktextract-data.jsonl";
const profileSpec = process.env.SEED_PROFILE ?? "core";
const outputPath = process.env.SEED_OUTPUT_PATH ?? `../../wikidata_downloads/seeds/${seedOutputName(profileSpec)}.jsonl`;
const targetSpec = resolveTargetSpec({
  profileSpec,
  targetSpec: process.env.SEED_TARGETS,
  targetMode: process.env.SEED_TARGETS_MODE ?? "append"
});
const limitPerTarget = Number(process.env.SEED_LIMIT_PER_TARGET ?? 1);

const targets = parseSeedTargets(targetSpec);

if (targets.length === 0) {
  throw new Error("Seed extraction must include at least one target from SEED_PROFILE or SEED_TARGETS");
}

const result = await extractSeedEntries({
  inputPath,
  outputPath,
  targets,
  limitPerTarget
});

console.log({
  profileSpec,
  targetCount: targets.length,
  result
});

type ResolveTargetSpecOptions = {
  profileSpec: string;
  targetSpec?: string;
  targetMode: string;
};

/** Resolves the profile defaults and optional ad hoc targets into one seed target string. */
function resolveTargetSpec(options: ResolveTargetSpecOptions): string {
  const explicitTargets = options.targetSpec ? parseTargetSpec(options.targetSpec) : [];

  switch (options.targetMode) {
    case "append": {
      const profileTargets = resolveSeedProfiles(options.profileSpec).targetSpecs;
      return dedupeTargetSpecs([...profileTargets, ...explicitTargets]).join(",");
    }
    case "replace":
      return dedupeTargetSpecs(explicitTargets).join(",");
    default:
      throw new Error('SEED_TARGETS_MODE must be either "append" or "replace"');
  }
}

/** Parses the environment target string before the graph importer converts specs into match objects. */
function parseTargetSpec(targetSpec: string): string[] {
  return targetSpec
    .split(",")
    .map((target) => target.trim())
    .filter((target) => target.length > 0);
}

/** Creates a readable default seed filename from the selected profile list. */
function seedOutputName(profileSpec: string): string {
  const profileSlug = profileSpec
    .split(",")
    .map((profileName) => profileName.trim())
    .filter((profileName) => profileName.length > 0)
    .join("-");

  return `${profileSlug || "custom"}-seed`;
}
