import { generateStructured } from "@/lib/ai/provider";
import type { ScoredTrend, WorkspaceConfig } from "@/lib/types";
import {
  buildContentSchema,
  selectedKinds,
  validateContent,
  type AssetKind,
  type GeneratedContent,
} from "./schema";

/**
 * The content generator. This prompt is the actual product — the difference
 * between "AI wrote something" and "I would post this" lives here, so it is
 * written as craft rules with worked examples rather than a list of adjectives.
 */

const SYSTEM = `You write social content for a specific creator in a specific niche. Your output gets posted as-is, so it has to be good enough that a sharp person would put their name on it.

## The one rule everything else serves
Say something a reader could not have guessed before reading. Every asset must carry at least one specific fact, number, name, or mechanism drawn from the source material. Content that could have been written without reading the sources is a failure, no matter how polished it sounds.

## Craft rules

HOOKS
- The hook makes a claim, not an announcement. "Most teams pick the wrong one" beats "Here's my take on X".
- Specific beats clever. A number, a name, or a cost lands harder than wordplay.
- No question-mark openers. No "Let's talk about". No "Here's the thing:".
- Three hooks means three genuinely different entry points, not three rewordings.

X THREADS
- Post 1 must work alone in a timeline with no context.
- One idea per post. If a post has two ideas, split it.
- Vary rhythm — a 200-character post next to a 40-character one reads better than eight uniform blocks.
- No numbering, no "🧵", no hashtags, no "follow me for more".
- The final post closes the loop the hook opened. It resolves; it does not advertise.

LINKEDIN
- The first line is the whole game — it must survive truncation at ~140 characters and still make someone tap.
- Write in short paragraphs with blank lines between. Two or three sentences maximum per block.
- Concrete over abstract: name the tool, the number, the tradeoff.
- End with a real question you would actually want answered. Not "Thoughts?" and not "Agree?".
- No hashtags. No emoji bullet points. No "🚀". No "I'm excited to share".

SHORT-FORM VIDEO
- The first 3 seconds must give a reason to stay: a claim, a visual surprise, or a stakes statement.
- Write spoken English, not written English. Contractions. Fragments. Say it out loud in your head.
- Budget roughly 2.5 spoken words per second and hit the stated duration.
- Every visual note must be shootable by one person with a laptop and a phone. "Screen recording of the pricing page, cursor hovering the $200 tier" — not "dynamic visuals".

CAROUSELS
- Cover slide earns the swipe. Each slide earns the next.
- One idea per slide, and the slides must build — remove slide 3 and slide 4 should stop making sense.
- Body text under 200 characters. This is a slide, not a paragraph.

## Banned
These phrases and their variants are forbidden: "game-changer", "in today's fast-paced world", "buckle up", "let that sink in", "the future of", "revolutionize", "unlock", "delve", "it's not just X, it's Y", "here's the kicker", "dive in", "supercharge", "leverage" (as a verb), "seamless", "elevate your".
Never open a piece with "Ever wondered".
No em-dashes as a stylistic tic. No rhetorical-question chains.

## Honesty
You may only assert facts that appear in the source material you are given. If the sources are thin, write something narrower and true rather than something broad and invented. Never fabricate statistics, quotes, company announcements, or dates. If you reference a number, it must be traceable to the sources.`;

export interface GenerateOptions {
  trend: Pick<ScoredTrend, "title" | "summary" | "why" | "angles" | "context"> & {
    evidence?: { source: string; title: string; url: string; metricLabel: string }[];
  };
  workspace: WorkspaceConfig;
  /** Overrides the workspace's platform/style selection for a one-off run. */
  kinds?: AssetKind[];
  /** Steer a regeneration, e.g. "punchier, less corporate". */
  steer?: string;
}

export interface GenerateResult {
  content: GeneratedContent;
  kinds: AssetKind[];
  provider: string;
  model: string;
  latencyMs: number;
  warnings: string[];
}

export async function generateContent(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const kinds =
    opts.kinds ?? selectedKinds(opts.workspace.platforms, opts.workspace.styles);
  const schema = buildContentSchema(kinds);

  const evidenceBlock = (opts.trend.evidence ?? [])
    .map((e) => `- [${e.source}] ${e.title} (${e.metricLabel})\n  ${e.url}`)
    .join("\n");

  const prompt = [
    `NICHE: ${opts.workspace.niche}`,
    opts.workspace.keywords.length
      ? `AUDIENCE KEYWORDS: ${opts.workspace.keywords.join(", ")}`
      : null,
    opts.workspace.brandVoice
      ? `CREATOR VOICE (match this): ${opts.workspace.brandVoice}`
      : null,
    "",
    `TOPIC: ${opts.trend.title}`,
    opts.trend.summary ? `WHAT IT IS: ${opts.trend.summary}` : null,
    opts.trend.why ? `WHY IT IS RISING NOW: ${opts.trend.why}` : null,
    opts.trend.angles?.length
      ? `CANDIDATE ANGLES:\n${opts.trend.angles.map((a) => `- ${a}`).join("\n")}`
      : null,
    "",
    "SOURCE MATERIAL (everything you assert must come from here):",
    opts.trend.context || evidenceBlock || "(no additional source detail)",
    evidenceBlock && opts.trend.context ? `\nLINKS:\n${evidenceBlock}` : null,
    "",
    opts.steer ? `EXTRA DIRECTION FROM THE CREATOR: ${opts.steer}` : null,
    `Write the requested assets. Pick the single strongest angle and commit to it across every asset rather than hedging across all three.`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const { data, provider, model, latencyMs } =
    await generateStructured<GeneratedContent>({
      system: SYSTEM,
      prompt,
      schema,
      schemaName: "content_assets",
      schemaDescription: "Platform-ready content assets for this topic.",
      maxTokens: 8000,
      temperature: 0.8,
    });

  return {
    content: data,
    kinds,
    provider,
    model,
    latencyMs,
    warnings: validateContent(data, kinds),
  };
}
