import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __trendforgeClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__trendforgeClient ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./trendforge.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__trendforgeClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
