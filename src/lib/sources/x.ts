import { fetchJson, HttpError } from "@/lib/http";
import type { RawSignal, SourceResult, WorkspaceConfig } from "@/lib/types";

/**
 * X / Twitter source — uses the official v2 recent-search endpoint.
 *
 * Requires X_BEARER_TOKEN. X removed the free read tier, so a paid plan
 * (Basic, ~$200/mo at time of writing) is needed for /2/tweets/search/recent.
 * Without a token this source reports `needsConfig` and the rest of the
 * refresh carries on without it — nothing else breaks.
 *
 * Set X_BEARER_TOKEN in .env once you have a plan; no code changes needed.
 */

const API = "https://api.x.com/2";

interface SearchResponse {
  data?: Array<{
    id: string;
    text: string;
    created_at?: string;
    author_id?: string;
    public_metrics?: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      impression_count?: number;
      bookmark_count?: number;
    };
  }>;
  includes?: { users?: Array<{ id: string; username: string; name: string }> };
  errors?: Array<{ detail?: string; title?: string }>;
}

/** Weighted engagement per hour, log-compressed onto 0-100. */
export function xVelocity(
  metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    bookmark_count?: number;
  },
  ageHours: number,
): number {
  // Reposts and quotes signal spread; bookmarks signal utility. Weight those
  // above raw likes, which are the cheapest action on the platform.
  const weighted =
    metrics.like_count +
    metrics.retweet_count * 3 +
    metrics.quote_count * 3 +
    metrics.reply_count * 2 +
    (metrics.bookmark_count ?? 0) * 4;
  const perHour = weighted / Math.max(ageHours, 0.5);
  return Math.round(
    Math.min(100, Math.max(0, (Math.log10(Math.max(perHour, 1)) / 3) * 100)),
  );
}

export function buildQuery(workspace: WorkspaceConfig): string {
  const terms = [workspace.niche, ...workspace.keywords]
    .filter(Boolean)
    .slice(0, 4)
    .map((t) => (t.includes(" ") ? `"${t}"` : t));
  const topic = terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0];
  // Originals only, English, no retweet/reply noise, skip links-only spam.
  return `${topic} -is:retweet -is:reply lang:en`;
}

export async function fetchXSignals(
  workspace: WorkspaceConfig,
): Promise<SourceResult> {
  const started = Date.now();
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    return {
      source: "x",
      signals: [],
      needsConfig: true,
      error:
        "X_BEARER_TOKEN not set. X has no free read tier — add a bearer token from a paid X API plan to enable this source.",
      tookMs: Date.now() - started,
    };
  }

  const params = new URLSearchParams({
    query: buildQuery(workspace),
    max_results: "100",
    sort_order: "relevancy",
    "tweet.fields": "public_metrics,created_at,author_id",
    expansions: "author_id",
    "user.fields": "username,name",
  });

  try {
    const res = await fetchJson<SearchResponse>(
      `${API}/tweets/search/recent?${params}`,
      {
        headers: { authorization: `Bearer ${token}` },
        timeoutMs: 15_000,
      },
    );

    const usersById = new Map(
      (res.includes?.users ?? []).map((u) => [u.id, u.username]),
    );

    const signals: RawSignal[] = (res.data ?? [])
      .map((tweet) => {
        const m = tweet.public_metrics ?? {
          like_count: 0,
          retweet_count: 0,
          reply_count: 0,
          quote_count: 0,
        };
        const createdAt = tweet.created_at
          ? new Date(tweet.created_at)
          : undefined;
        const ageHours = createdAt
          ? (Date.now() - createdAt.getTime()) / 3_600_000
          : 12;
        const username = tweet.author_id
          ? (usersById.get(tweet.author_id) ?? "i")
          : "i";
        const engagement =
          m.like_count + m.retweet_count + m.reply_count + m.quote_count;
        return {
          source: "x" as const,
          title: firstLine(tweet.text),
          context: tweet.text,
          url: `https://x.com/${username}/status/${tweet.id}`,
          metric: engagement,
          metricLabel: `${compact(m.like_count)} likes · ${compact(
            m.retweet_count,
          )} reposts in ${Math.round(ageHours)}h`,
          velocity: xVelocity(m, ageHours),
          createdAt,
          meta: { username, metrics: m },
        };
      })
      .filter((s) => s.metric >= 10)
      .sort((a, b) => b.velocity - a.velocity);

    return {
      source: "x",
      signals: signals.slice(0, 40),
      tookMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof HttpError ? err.message : String(err);
    return {
      source: "x",
      signals: [],
      error: `X search failed: ${message}${
        err instanceof HttpError && err.status === 403
          ? " (403 usually means your X API plan does not include recent search)"
          : ""
      }`,
      tookMs: Date.now() - started,
    };
  }
}

function firstLine(text: string): string {
  const cleaned = text.replace(/https?:\/\/\S+/g, "").trim();
  const line = cleaned.split("\n").find((l) => l.trim().length > 12) ?? cleaned;
  return line.trim().slice(0, 160);
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
