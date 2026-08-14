import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUserId } from "@/lib/session";
import { PLATFORMS, STYLES } from "@/lib/types";

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  niche: z.string().min(2).max(120).optional(),
  keywords: z.array(z.string().min(1).max(60)).max(12).optional(),
  platforms: z.array(z.enum(PLATFORMS)).min(1).optional(),
  styles: z.array(z.enum(STYLES)).min(1).optional(),
  subreddits: z.array(z.string().min(1).max(40)).max(10).optional(),
  brandVoice: z.string().max(600).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const values: Record<string, unknown> = {};
  if (input.name !== undefined) values.name = input.name;
  if (input.niche !== undefined) values.niche = input.niche;
  if (input.keywords) values.keywords = JSON.stringify(input.keywords);
  if (input.platforms) values.platforms = JSON.stringify(input.platforms);
  if (input.styles) values.styles = JSON.stringify(input.styles);
  if (input.subreddits) values.subreddits = JSON.stringify(input.subreddits);
  if (input.brandVoice !== undefined) values.brandVoice = input.brandVoice;

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(schema.workspaces)
    .set(values)
    .where(
      and(eq(schema.workspaces.id, id), eq(schema.workspaces.userId, userId)),
    )
    .returning();

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ workspace: row });
}
