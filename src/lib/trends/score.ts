import type { RawSignal, SourceId, WorkspaceConfig } from "@/lib/types";

/**
 * Pure ranking math. No network, no AI — every function here is deterministic
 * and unit-tested, so the feed order is explainable rather than vibes.
 */

const STOPWORDS = new Set([
  "the","a","an","and","or","but","for","to","of","in","on","at","by","with",
  "is","are","was","were","be","been","it","its","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","their","from","as","how",
  "what","why","when","which","who","just","new","best","top","get","got","use",
  "using","about","into","after","before","more","most","can","will","do","does",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Keyword-overlap relevance, 0-100. Deliberately generous: this is a cheap
 * pre-filter that decides what the model even looks at, so recall matters more
 * than precision. The LLM pass does the real relevance judgement afterwards.
 */
export function heuristicRelevance(
  signal: RawSignal,
  workspace: WorkspaceConfig,
): number {
  const nicheTokens = new Set([
    ...tokenize(workspace.niche),
    ...workspace.keywords.flatMap(tokenize),
  ]);
  if (nicheTokens.size === 0) return 50;

  const haystack = new Set(
    tokenize(`${signal.title} ${signal.context ?? ""}`.slice(0, 600)),
  );
  let hits = 0;
  for (const token of nicheTokens) if (haystack.has(token)) hits += 1;

  const coverage = hits / nicheTokens.size;
  let score = Math.round(coverage * 100);

  // Google Trends queries are derived *from* the niche seed, so they carry an
  // inherent relevance floor even when the words don't literally overlap.
  if (signal.source === "google_trends") score = Math.max(score, 55);
  // A post pulled from a subreddit the user explicitly tracks is on-topic by
  // construction, whatever its wording.
  const sub = String(signal.meta?.subreddit ?? "").toLowerCase();
  if (
    sub &&
    workspace.subreddits.some((s) => s.replace(/^r\//, "").toLowerCase() === sub)
  ) {
    score = Math.max(score, 45);
  }

  return Math.min(100, score);
}

/**
 * Final feed ordering. Velocity is what makes a topic *timely*; relevance is
 * what makes it *usable*. Weighting velocity slightly higher keeps the feed
 * feeling live, and the multi-source bonus rewards topics that are rising in
 * more than one place — the strongest signal there is.
 */
export function blendScore(
  velocity: number,
  relevance: number,
  distinctSources: number,
): number {
  const base = velocity * 0.55 + relevance * 0.45;
  const corroboration = Math.min(distinctSources - 1, 2) * 6;
  return Math.round(Math.min(100, base + corroboration));
}

/** Velocity for a cluster: the strongest member, pulled up by its supporters. */
export function clusterVelocity(members: RawSignal[]): number {
  if (members.length === 0) return 0;
  const sorted = [...members].sort((a, b) => b.velocity - a.velocity);
  const lead = sorted[0].velocity;
  const rest = sorted.slice(1);
  const support = rest.length
    ? rest.reduce((a, s) => a + s.velocity, 0) / rest.length
    : 0;
  return Math.round(Math.min(100, lead * 0.75 + support * 0.25 + rest.length * 2));
}

export function distinctSources(members: RawSignal[]): SourceId[] {
  return [...new Set(members.map((m) => m.source))];
}

/** Picks the source that contributed the highest-velocity member. */
export function primarySource(members: RawSignal[]): SourceId {
  return [...members].sort((a, b) => b.velocity - a.velocity)[0]?.source ?? "reddit";
}

/**
 * Trims the candidate pool before it reaches the model. Keeps the field
 * balanced across sources so one loud source can't crowd out the others.
 */
export function prefilterSignals(
  signals: RawSignal[],
  workspace: WorkspaceConfig,
  limit = 45,
): RawSignal[] {
  const scored = signals
    .map((s) => ({
      signal: s,
      relevance: heuristicRelevance(s, workspace),
    }))
    .filter((s) => s.relevance >= 15 || s.signal.velocity >= 60)
    .map((s) => ({
      ...s,
      rank: s.signal.velocity * 0.5 + s.relevance * 0.5,
    }))
    .sort((a, b) => b.rank - a.rank);

  const perSourceCap = Math.ceil(limit / 2);
  const counts: Record<string, number> = {};
  const picked: RawSignal[] = [];

  for (const item of scored) {
    const src = item.signal.source;
    if ((counts[src] ?? 0) >= perSourceCap) continue;
    counts[src] = (counts[src] ?? 0) + 1;
    picked.push(item.signal);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Stable key so the same topic doesn't duplicate across refreshes. */
export function dedupeKey(title: string): string {
  const tokens = tokenize(title).sort().slice(0, 6);
  return tokens.length ? tokens.join("-") : title.toLowerCase().slice(0, 60);
}
