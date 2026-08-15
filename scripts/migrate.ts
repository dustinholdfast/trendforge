/**
 * Thin wrapper so `tsx scripts/migrate.ts` still works.
 * The canonical migrator is `scripts/migrate.mjs` (no tsx required).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "migrate.mjs");
const result = spawnSync(process.execPath, [script], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
