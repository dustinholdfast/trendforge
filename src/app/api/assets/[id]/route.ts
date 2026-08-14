import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUserId, listWorkspaces } from "@/lib/session";

const PatchSchema = z.object({
  status: z.enum(["draft", "scheduled", "used"]).optional(),
  /** ISO datetime, or null to clear. */
  scheduledFor: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  payload: z.unknown().optional(),
});

async function ownedWorkspaceIds(userId: string) {
  return (await listWorkspaces(userId)).map((w) => w.id);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const ids = await ownedWorkspaceIds(userId);
  if (ids.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const values: Record<string, unknown> = {};
  if (parsed.data.status) {
    values.status = parsed.data.status;
    values.usedAt = parsed.data.status === "used" ? new Date() : null;
    if (parsed.data.status === "draft") values.scheduledFor = null;
  }
  if (parsed.data.scheduledFor !== undefined) {
    values.scheduledFor = parsed.data.scheduledFor
      ? new Date(parsed.data.scheduledFor)
      : null;
    // Scheduling implies the scheduled state unless the caller said otherwise.
    if (parsed.data.scheduledFor && !parsed.data.status) values.status = "scheduled";
  }
  if (parsed.data.title) values.title = parsed.data.title;
  if (parsed.data.payload !== undefined) {
    values.payload = JSON.stringify(parsed.data.payload);
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(schema.contentAssets)
    .set(values)
    .where(
      and(
        eq(schema.contentAssets.id, id),
        inArray(schema.contentAssets.workspaceId, ids),
      ),
    )
    .returning();

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ asset: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ids = await ownedWorkspaceIds(userId);
  if (ids.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [row] = await db
    .delete(schema.contentAssets)
    .where(
      and(
        eq(schema.contentAssets.id, id),
        inArray(schema.contentAssets.workspaceId, ids),
      ),
    )
    .returning();

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
