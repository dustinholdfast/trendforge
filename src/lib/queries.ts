import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { TrendEvidence } from "@/lib/types";

export interface TrendView {
  id: string;
  title: string;
  summary: string;
  why: string;
  primarySource: string;
  evidence: TrendEvidence[];
  angles: string[];
  velocity: number;
  relevance: number;
  score: number;
  discoveredAt: Date;
  assetCount: number;
}

const FRESH_WINDOW_MS = 7 * 24 * 3_600_000;

export async function getFeed(workspaceId: string): Promise<TrendView[]> {
  const rows = await db
    .select()
    .from(schema.trends)
    .where(
      and(
        eq(schema.trends.workspaceId, workspaceId),
        gte(schema.trends.discoveredAt, new Date(Date.now() - FRESH_WINDOW_MS)),
      ),
    )
    .orderBy(desc(schema.trends.score))
    .limit(40);

  const assets = await db
    .select({
      trendId: schema.contentAssets.trendId,
    })
    .from(schema.contentAssets)
    .where(eq(schema.contentAssets.workspaceId, workspaceId));

  const counts = new Map<string, number>();
  for (const a of assets) {
    if (!a.trendId) continue;
    counts.set(a.trendId, (counts.get(a.trendId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    why: r.why,
    primarySource: r.primarySource,
    evidence: safeParse<TrendEvidence[]>(r.evidence, []),
    angles: safeParse<string[]>(r.angles, []),
    velocity: r.velocity,
    relevance: r.relevance,
    score: r.score,
    discoveredAt: r.discoveredAt,
    assetCount: counts.get(r.id) ?? 0,
  }));
}

export async function getTrend(workspaceId: string, trendId: string) {
  const [row] = await db
    .select()
    .from(schema.trends)
    .where(
      and(
        eq(schema.trends.id, trendId),
        eq(schema.trends.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getAssetsForTrend(trendId: string) {
  return db
    .select()
    .from(schema.contentAssets)
    .where(eq(schema.contentAssets.trendId, trendId))
    .orderBy(desc(schema.contentAssets.createdAt));
}

export async function getLibrary(workspaceId: string) {
  return db
    .select()
    .from(schema.contentAssets)
    .where(eq(schema.contentAssets.workspaceId, workspaceId))
    .orderBy(desc(schema.contentAssets.createdAt))
    .limit(200);
}

export async function getScheduled(workspaceId: string) {
  return db
    .select()
    .from(schema.contentAssets)
    .where(
      and(
        eq(schema.contentAssets.workspaceId, workspaceId),
        isNotNull(schema.contentAssets.scheduledFor),
      ),
    );
}

export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
