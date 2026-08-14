import { fetchJson, HttpError } from "@/lib/http";
import type { RawSignal, SourceResult, WorkspaceConfig } from "@/lib/types";

/**
 * Reddit source.
 *
 * Works two ways:
 *  1. Authenticated (preferred) — set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
 *     Create a "script" app at https://www.reddit.com/prefs/apps. Free, and far
 *     less likely to get rate-limited than the public endpoints.
 *  2. Anonymous — falls back to the public *.json endpoints. Works, but Reddit
 *     throttles unauthenticated traffic hard and will 429 under any real load.
 */

interface RedditListing {
  data?: {
    children?: Array<{
      kind?: string;
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        permalink?: string;
        url?: string;
        score?: number;
        num_comments?: number;
        created_utc?: number;
        subreddit?: string;
        display_name?: string;
        subscribers?: number;
        over_18?: boolean;
        stickied?: boolean;
      };
    }>;
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetchJson<{ access_token?: string; expires_in?: number }>(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      body,
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      timeoutMs: 10_000,
    },
  );
  if (!res.access_token) return null;
  cachedToken = {
    token: res.access_token,
    expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function redditGet<T>(path: string, query: Record<string, string>) {
  const token = await getAppToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const suffix = token ? "" : ".json";
  const qs = new URLSearchParams({ ...query, raw_json: "1" }).toString();
  return fetchJson<T>(`${base}${path}${suffix}?${qs}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    timeoutMs: 12_000,
  });
}

/** Suggests subreddits for a niche. Used at workspace-create time. */
export async function suggestSubreddits(niche: string): Promise<string[]> {
  try {
    const data = await redditGet<RedditListing>("/subreddits/search", {
      q: niche,
      limit: "12",
      sort: "relevance",
    });
    return (data.data?.children ?? [])
      .map((c) => c.data)
      .filter((d): d is NonNullable<typeof d> => Boolean(d?.display_name))
      .filter((d) => !d.over_18 && (d.subscribers ?? 0) > 2_000)
      .slice(0, 6)
      .map((d) => d.display_name!);
  } catch {
    return [];
  }
}

/**
 * Velocity proxy: upvotes per hour, log-compressed so a 40k-subscriber
 * subreddit and a 4M-subscriber one land on a comparable 0-100 scale.
 */
export function redditVelocity(score: number, ageHours: number): number {
  const perHour = score / Math.max(ageHours, 0.5);
  // ~1/hr -> 0, ~10/hr -> 33, ~100/hr -> 67, ~1000/hr -> 100
  const normalized = (Math.log10(Math.max(perHour, 1)) / 3) * 100;
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

export async function fetchRedditSignals(
  workspace: WorkspaceConfig,
): Promise<SourceResult> {
  const started = Date.now();
  const subs = workspace.subreddits.filter(Boolean);
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  const targets: Array<{ path: string; query: Record<string, string> }> = subs
    .slice(0, 6)
    .map((sub) => ({
      path: `/r/${sub.replace(/^r\//, "")}/top`,
      query: { t: "day", limit: "25" },
    }));

  // Always include a niche-wide search so we are not blind to subreddits the
  // user hasn't listed.
  targets.push({
    path: "/search",
    query: {
      q: [workspace.niche, ...workspace.keywords].slice(0, 4).join(" OR "),
      sort: "top",
      t: "week",
      limit: "25",
      type: "link",
    },
  });

  const results = await Promise.allSettled(
    targets.map((t) => redditGet<RedditListing>(t.path, t.query)),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      const err = result.reason;
      errors.push(err instanceof HttpError ? err.message : String(err));
      continue;
    }
    for (const child of result.value.data?.children ?? []) {
      const d = child.data;
      if (!d?.title || !d.permalink || d.stickied || d.over_18) continue;
      const createdAt = d.created_utc ? new Date(d.created_utc * 1000) : undefined;
      const ageHours = createdAt
        ? (Date.now() - createdAt.getTime()) / 3_600_000
        : 24;
      const score = d.score ?? 0;
      if (score < 15) continue;
      signals.push({
        source: "reddit",
        title: d.title.trim(),
        context: (d.selftext ?? "").slice(0, 900),
        url: `https://www.reddit.com${d.permalink}`,
        metric: score,
        metricLabel: `${formatCount(score)} upvotes · ${formatCount(
          d.num_comments ?? 0,
        )} comments in ${Math.round(ageHours)}h`,
        velocity: redditVelocity(score, ageHours),
        createdAt,
        meta: { subreddit: d.subreddit, comments: d.num_comments },
      });
    }
  }

  // Dedupe by post URL, keep the highest scoring.
  const byUrl = new Map<string, RawSignal>();
  for (const s of signals) {
    const existing = byUrl.get(s.url);
    if (!existing || s.metric > existing.metric) byUrl.set(s.url, s);
  }
  const deduped = [...byUrl.values()].sort((a, b) => b.velocity - a.velocity);

  return {
    source: "reddit",
    signals: deduped.slice(0, 40),
    error:
      deduped.length === 0 && errors.length
        ? `Reddit unreachable: ${errors[0]}`
        : undefined,
    tookMs: Date.now() - started,
  };
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
