import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUserId, getWorkspace, toWorkspaceConfig } from "@/lib/session";
import { runDiscovery } from "@/lib/trends/discover";

export const maxDuration = 120;

const BodySchema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const row = await getWorkspace(userId, parsed.data.workspaceId);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const config = toWorkspaceConfig(row);
  const result = await runDiscovery(config);

  // Upsert on (workspaceId, dedupeKey) so a topic that keeps rising updates in
  // place instead of duplicating across refreshes.
  for (const trend of result.trends) {
    await db
      .insert(schema.trends)
      .values({
        workspaceId: row.id,
        dedupeKey: trend.dedupeKey,
        title: trend.title,
        summary: trend.summary,
        primarySource: trend.primarySource,
        evidence: JSON.stringify(trend.evidence),
        velocity: trend.velocity,
        relevance: trend.relevance,
        score: trend.score,
        why: trend.why,
        angles: JSON.stringify(trend.angles),
        discoveredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.trends.workspaceId, schema.trends.dedupeKey],
        set: {
          title: trend.title,
          summary: trend.summary,
          primarySource: trend.primarySource,
          evidence: JSON.stringify(trend.evidence),
          velocity: trend.velocity,
          relevance: trend.relevance,
          score: trend.score,
          why: trend.why,
          angles: JSON.stringify(trend.angles),
          discoveredAt: new Date(),
        },
      });
  }

  await db
    .update(schema.workspaces)
    .set({ lastRefreshedAt: new Date() })
    .where(eq(schema.workspaces.id, row.id));

  // Stale trends are filtered out of the feed by date rather than deleted —
  // deleting would take any generated content down with them.

  return NextResponse.json({
    count: result.trends.length,
    tookMs: result.tookMs,
    degraded: result.degraded,
    sources: result.sources.map((s) => ({
      source: s.source,
      count: s.signals.length,
      error: s.error,
      needsConfig: s.needsConfig,
      tookMs: s.tookMs,
    })),
  });
}
