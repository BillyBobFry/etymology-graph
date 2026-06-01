import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const huskyBin = join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "husky.cmd" : "husky",
);

/**
 * Checks for the optional Husky dev dependency before production installs run lifecycle scripts.
 */
const hasHuskyBinary = () => {
  try {
    accessSync(huskyBin, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

if (!hasHuskyBinary()) {
  console.log("Skipping Husky install because the husky binary is not available.");
  process.exit(0);
}

const result = spawnSync(huskyBin, {
  cwd: rootDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
