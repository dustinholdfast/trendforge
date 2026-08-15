/**
 * Applies the SQL migrations in ./drizzle to the configured database.
 * Idempotent — safe to run on every deploy (local `npm run db:migrate`
 * and the Docker entrypoint both call this).
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
  await import("dotenv/config");
} catch {
  // Env is injected by Docker / the process; dotenv is optional here.
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = resolve(root, "drizzle");
const url = process.env.DATABASE_URL ?? "file:./trendforge.db";

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  console.log(`✓ migrations applied to ${url}`);
} finally {
  client.close();
}
