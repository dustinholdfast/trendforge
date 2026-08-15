/**
 * Container entrypoint.
 *
 * 1. Create the SQLite data directory if it is missing.
 * 2. Apply Drizzle migrations (idempotent).
 * 3. Exec the Next.js standalone server so signals reach Node.
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR ?? "/data";

mkdirSync(dataDir, { recursive: true });

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });
    child.on("error", fail);
    child.on("exit", (code, signal) => {
      if (signal) fail(new Error(`${cmd} exited via ${signal}`));
      else if (code === 0) ok();
      else fail(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run(process.execPath, [resolve(root, "scripts/migrate.mjs")]);

const forwarded = process.argv.slice(2);
const cmd = forwarded[0] ?? process.execPath;
const args = forwarded.length > 0 ? forwarded.slice(1) : ["server.js"];

const server = spawn(cmd, args, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

const forward = (signal) => {
  if (!server.killed) server.kill(signal);
};

process.on("SIGTERM", () => forward("SIGTERM"));
process.on("SIGINT", () => forward("SIGINT"));

server.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }
  process.exit(code ?? 1);
});
