import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUserId } from "@/lib/session";
import { suggestSubreddits } from "@/lib/sources/reddit";
import { PLATFORMS, STYLES } from "@/lib/types";

const CreateSchema = z.object({
  niche: z.string().min(2).max(120),
  name: z.string().min(1).max(80).optional(),
  keywords: z.array(z.string().min(1).max(60)).max(12).optional(),
  platforms: z.array(z.enum(PLATFORMS)).min(1).optional(),
  styles: z.array(z.enum(STYLES)).min(1).optional(),
  subreddits: z.array(z.string().min(1).max(40)).max(10).optional(),
  brandVoice: z.string().max(600).optional(),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // If the user didn't name subreddits, ask Reddit which ones match the niche.
  // Never block workspace creation on it.
  let subreddits = input.subreddits ?? [];
  if (subreddits.length === 0) {
    subreddits = await suggestSubreddits(input.niche);
  }

  const [row] = await db
    .insert(schema.workspaces)
    .values({
      userId,
      name: input.name ?? input.niche,
      niche: input.niche,
      keywords: JSON.stringify(input.keywords ?? []),
      platforms: JSON.stringify(input.platforms ?? PLATFORMS),
      styles: JSON.stringify(input.styles ?? STYLES),
      subreddits: JSON.stringify(subreddits),
      brandVoice: input.brandVoice ?? null,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json({ workspace: row }, { status: 201 });
}
