import { generateStructured, type JsonSchema } from "@/lib/ai/provider";
import { fetchGoogleTrendsSignals } from "@/lib/sources/google-trends";
import { fetchRedditSignals } from "@/lib/sources/reddit";
import { fetchXSignals } from "@/lib/sources/x";
import type {
  RawSignal,
  ScoredTrend,
  SourceResult,
  TrendEvidence,
  WorkspaceConfig,
} from "@/lib/types";
import {
  blendScore,
  clusterVelocity,
  dedupeKey,
  distinctSources,
  heuristicRelevance,
  prefilterSignals,
  primarySource,
} from "./score";

export interface DiscoveryResult {
  trends: ScoredTrend[];
  sources: SourceResult[];
  tookMs: number;
  /** Set when clustering fell back to heuristics (no AI key, or AI failed). */
  degraded?: string;
}

const CLUSTER_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["trends"],
  properties: {
    trends: {
      type: "array",
      description: "Distinct rising topics, most compelling first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "why", "relevance", "angles", "signalIds"],
        properties: {
          title: {
            type: "string",
            description:
              "The specific topic in 3-9 words. Name the actual thing, not a category. 'Cursor's new agent mode', not 'AI coding tools'.",
          },
          summary: {
            type: "string",
            description:
              "2 sentences a smart outsider could read and immediately understand what this topic is and what happened.",
          },
          why: {
            type: "string",
            description:
              "One sentence on why this is rising RIGHT NOW — the specific trigger, not a generic statement of interest.",
          },
          relevance: {
            type: "integer",
            description:
              "0-100: how directly useful this is to someone creating content for the stated niche. Be harsh; 100 means squarely on-topic.",
          },
          angles: {
            type: "array",
            description:
              "3 distinct content angles a creator could take. Each is a specific claim or framing, not a topic label.",
            items: { type: "string" },
          },
          signalIds: {
            type: "array",
            description: "IDs of the source signals that support this trend.",
            items: { type: "integer" },
          },
        },
      },
    },
  },
};

interface ClusterResponse {
  trends: Array<{
    title: string;
    summary: string;
    why: string;
    relevance: number;
    angles: string[];
    signalIds: number[];
  }>;
}

const CLUSTER_SYSTEM = `You are a trend analyst for content creators. You read raw signals scraped from Reddit, Google Trends and X, and you turn them into a short list of genuinely distinct rising topics.

What separates a good output from a bad one:
- SPECIFICITY. "AI agents are getting popular" is worthless. "Anthropic's MCP is being adopted by three major IDEs in one week" is useful. Name products, people, numbers, and events.
- MERGING. Several signals often describe one topic. Merge them and cite every supporting signal id. Never emit two entries that a reader would consider the same story.
- HONESTY. If the signals are thin, return fewer trends. Never invent a trend that the signals do not support, and never invent facts that are not in the signal text. You may not add details you were not given.
- RELEVANCE DISCIPLINE. Score relevance against the stated niche only. A viral post that has nothing to do with the niche gets a low score even if it is huge.

Discard signals that are pure noise: memes with no informational content, job posts, self-promo, and generic "what do you think" threads.`;

export async function runDiscovery(
  workspace: WorkspaceConfig,
): Promise<DiscoveryResult> {
  const started = Date.now();

  const sources = await Promise.all([
    fetchRedditSignals(workspace).catch(errorResult("reddit")),
    fetchGoogleTrendsSignals(workspace).catch(errorResult("google_trends")),
    fetchXSignals(workspace).catch(errorResult("x")),
  ]);

  const allSignals = sources.flatMap((s) => s.signals);
  if (allSignals.length === 0) {
    return { trends: [], sources, tookMs: Date.now() - started };
  }

  const candidates = prefilterSignals(allSignals, workspace);

  try {
    const trends = await clusterWithAi(candidates, workspace);
    return { trends, sources, tookMs: Date.now() - started };
  } catch (err) {
    const trends = clusterHeuristically(candidates, workspace);
    return {
      trends,
      sources,
      tookMs: Date.now() - started,
      degraded: `AI clustering unavailable (${
        (err as Error).message
      }) — showing raw signals ranked by velocity and keyword relevance.`,
    };
  }
}

async function clusterWithAi(
  candidates: RawSignal[],
  workspace: WorkspaceConfig,
): Promise<ScoredTrend[]> {
  const lines = candidates
    .map((s, i) => {
      const context = (s.context ?? "").replace(/\s+/g, " ").slice(0, 400);
      return [
        `[${i}] source=${s.source} velocity=${s.velocity} (${s.metricLabel})`,
        `    title: ${s.title}`,
        context ? `    context: ${context}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const prompt = `NICHE: ${workspace.niche}
${workspace.keywords.length ? `KEYWORDS: ${workspace.keywords.join(", ")}` : ""}

SIGNALS (${candidates.length}):
${lines}

Cluster these into at most 12 distinct rising topics that a creator in this niche could make content about today. Order them by how compelling they are for this specific niche. Use only information present in the signals above.`;

  const { data } = await generateStructured<ClusterResponse>({
    system: CLUSTER_SYSTEM,
    prompt,
    schema: CLUSTER_SCHEMA,
    schemaName: "rising_trends",
    schemaDescription: "The clustered, ranked list of rising topics.",
    maxTokens: 6000,
    temperature: 0.4,
  });

  const trends: ScoredTrend[] = [];
  const seen = new Set<string>();

  for (const t of data.trends ?? []) {
    const members = (t.signalIds ?? [])
      .map((id) => candidates[id])
      .filter((s): s is RawSignal => Boolean(s));
    if (members.length === 0) continue;

    const key = dedupeKey(t.title);
    if (seen.has(key)) continue;
    seen.add(key);

    const velocity = clusterVelocity(members);
    const relevance = clamp(t.relevance ?? 0);
    const sourcesFor = distinctSources(members);

    trends.push({
      dedupeKey: key,
      title: t.title.trim(),
      summary: (t.summary ?? "").trim(),
      why: (t.why ?? "").trim(),
      angles: (t.angles ?? []).slice(0, 4),
      primarySource: primarySource(members),
      evidence: members.slice(0, 6).map(toEvidence),
      velocity,
      relevance,
      score: blendScore(velocity, relevance, sourcesFor.length),
      context: buildContext(members),
    });
  }

  return trends.sort((a, b) => b.score - a.score);
}

/** No-AI fallback: one trend per signal, ranked by the same blended formula. */
function clusterHeuristically(
  candidates: RawSignal[],
  workspace: WorkspaceConfig,
): ScoredTrend[] {
  const seen = new Set<string>();
  const trends: ScoredTrend[] = [];

  for (const s of candidates) {
    const key = dedupeKey(s.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const relevance = heuristicRelevance(s, workspace);
    trends.push({
      dedupeKey: key,
      title: s.title.slice(0, 120),
      summary: (s.context ?? "").slice(0, 280) || s.title,
      why: `Rising on ${s.source.replace("_", " ")} — ${s.metricLabel}.`,
      angles: [],
      primarySource: s.source,
      evidence: [toEvidence(s)],
      velocity: s.velocity,
      relevance,
      score: blendScore(s.velocity, relevance, 1),
      context: buildContext([s]),
    });
    if (trends.length >= 12) break;
  }
  return trends.sort((a, b) => b.score - a.score);
}

function toEvidence(s: RawSignal): TrendEvidence {
  return {
    source: s.source,
    title: s.title.slice(0, 200),
    url: s.url,
    metricLabel: s.metricLabel,
  };
}

/** Source text handed to the content generator so it writes from facts. */
function buildContext(members: RawSignal[]): string {
  return members
    .slice(0, 6)
    .map((m) => {
      const body = (m.context ?? "").replace(/\s+/g, " ").slice(0, 500);
      return `- [${m.source}] ${m.title}${body ? `\n  ${body}` : ""}\n  (${m.metricLabel}) ${m.url}`;
    })
    .join("\n");
}

function errorResult(source: SourceResult["source"]) {
  return (err: unknown): SourceResult => ({
    source,
    signals: [],
    error: (err as Error)?.message ?? "unknown error",
    tookMs: 0,
  });
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
