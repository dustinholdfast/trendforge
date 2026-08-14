import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { parseJsonArray, type Platform, type Style, type WorkspaceConfig } from "@/lib/types";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) redirect("/signin");
  return id;
}

export function toWorkspaceConfig(
  row: typeof schema.workspaces.$inferSelect,
): WorkspaceConfig {
  return {
    id: row.id,
    niche: row.niche,
    keywords: parseJsonArray(row.keywords),
    platforms: parseJsonArray(row.platforms) as Platform[],
    styles: parseJsonArray(row.styles) as Style[],
    subreddits: parseJsonArray(row.subreddits),
    brandVoice: row.brandVoice,
  };
}

export async function listWorkspaces(userId: string) {
  return db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.userId, userId));
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(schema.workspaces)
    .where(
      and(
        eq(schema.workspaces.id, workspaceId),
        eq(schema.workspaces.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** The workspace the app opens to — most recently created. */
export async function getActiveWorkspace(userId: string) {
  const rows = await listWorkspaces(userId);
  if (rows.length === 0) return null;
  return rows.sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  )[0];
}
