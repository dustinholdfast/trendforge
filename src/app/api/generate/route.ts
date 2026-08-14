import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { AiNotConfiguredError } from "@/lib/ai/provider";
import { generateContent } from "@/lib/content/generate";
import { toAssetRows } from "@/lib/content/schema";
import { getCurrentUserId, getWorkspace, toWorkspaceConfig } from "@/lib/session";
import { parseJsonArray } from "@/lib/types";

export const maxDuration = 120;

const BodySchema = z.object({
  trendId: z.string().min(1),
  steer: z.string().max(300).optional(),
  /** When true, replaces the previous assets for this trend. */
  regenerate: z.boolean().optional(),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "trendId required" }, { status: 400 });
  }

  const [trend] = await db
    .select()
    .from(schema.trends)
    .where(eq(schema.trends.id, parsed.data.trendId))
    .limit(1);
  if (!trend) return NextResponse.json({ error: "not found" }, { status: 404 });

  const workspaceRow = await getWorkspace(userId, trend.workspaceId);
  if (!workspaceRow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const workspace = toWorkspaceConfig(workspaceRow);
  const evidence = safeEvidence(trend.evidence);

  try {
    const result = await generateContent({
      workspace,
      steer: parsed.data.steer,
      trend: {
        title: trend.title,
        summary: trend.summary,
        why: trend.why,
        angles: parseJsonArray(trend.angles),
        context: evidence
          .map((e) => `- [${e.source}] ${e.title} (${e.metricLabel})`)
          .join("\n"),
        evidence,
      },
    });

    if (parsed.data.regenerate) {
      await db
        .delete(schema.contentAssets)
        .where(
          and(
            eq(schema.contentAssets.trendId, trend.id),
            eq(schema.contentAssets.status, "draft"),
          ),
        );
    }

    const [generation] = await db
      .insert(schema.generations)
      .values({
        workspaceId: workspace.id,
        trendId: trend.id,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        payload: JSON.stringify(result.content),
        createdAt: new Date(),
      })
      .returning();

    const rows = toAssetRows(result.content, trend.title);
    const assets = rows.length
      ? await db
          .insert(schema.contentAssets)
          .values(
            rows.map((r) => ({
              workspaceId: workspace.id,
              trendId: trend.id,
              generationId: generation.id,
              kind: r.kind,
              platform: r.platform,
              title: r.title,
              payload: JSON.stringify(r.payload),
              status: "draft" as const,
              createdAt: new Date(),
            })),
          )
          .returning()
      : [];

    return NextResponse.json({
      generationId: generation.id,
      content: result.content,
      assets,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      warnings: result.warnings,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: (err as Error).message ?? "generation failed" },
      { status: 502 },
    );
  }
}

function safeEvidence(json: string) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
