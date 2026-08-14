import { fetchJson, HttpError } from "@/lib/http";
import type { RawSignal, SourceResult, WorkspaceConfig } from "@/lib/types";

/**
 * Google Trends source — no API key required.
 *
 * Google has no official Trends API, so this drives the same two endpoints the
 * trends.google.com front-end uses:
 *
 *   1. /trends/api/explore          -> returns widget tokens for a keyword
 *   2. /trends/api/widgetdata/...   -> returns the actual data for a widget
 *
 * Both responses are prefixed with an XSSI guard that has to be stripped.
 * These are undocumented and Google rate-limits them (429) under load — every
 * failure here degrades gracefully rather than breaking the refresh.
 */

const HOST = "https://trends.google.com";

interface ExploreResponse {
  widgets?: Array<{
    id?: string;
    token?: string;
    request?: unknown;
  }>;
}

interface RelatedSearchesResponse {
  default?: {
    rankedList?: Array<{
      rankedKeyword?: Array<{
        query?: string;
        value?: number;
        formattedValue?: string;
        link?: string;
      }>;
    }>;
  };
}

interface MultilineResponse {
  default?: {
    timelineData?: Array<{ time?: string; value?: number[] }>;
  };
}

const tzOffset = () => new Date().getTimezoneOffset();

async function explore(keyword: string, geo: string, time: string) {
  const req = {
    comparisonItem: [{ keyword, geo, time }],
    category: 0,
    property: "",
  };
  const url =
    `${HOST}/trends/api/explore?hl=en-US&tz=${tzOffset()}` +
    `&req=${encodeURIComponent(JSON.stringify(req))}`;
  return fetchJson<ExploreResponse>(url, {
    stripXssiPrefix: true,
    timeoutMs: 12_000,
  });
}

async function widgetData<T>(
  widgetPath: "relatedsearches" | "multiline",
  request: unknown,
  token: string,
): Promise<T> {
  const url =
    `${HOST}/trends/api/widgetdata/${widgetPath}?hl=en-US&tz=${tzOffset()}` +
    `&req=${encodeURIComponent(JSON.stringify(request))}&token=${encodeURIComponent(token)}`;
  return fetchJson<T>(url, { stripXssiPrefix: true, timeoutMs: 12_000 });
}

/**
 * Google reports rising queries as a percentage increase, or 5000 for
 * "Breakout" (>5000%). Log-compress onto 0-100 so a 90% riser and a breakout
 * are distinguishable but not 50x apart.
 */
export function googleVelocity(value: number): number {
  if (value >= 5000) return 100;
  const v = Math.max(value, 1);
  return Math.round(Math.min(100, (Math.log10(v) / Math.log10(5000)) * 100));
}

/** Slope of the last third of the series vs the first two thirds, as -100..100. */
export function seriesMomentum(values: number[]): number {
  if (values.length < 6) return 0;
  const split = Math.floor(values.length * (2 / 3));
  const early = values.slice(0, split);
  const late = values.slice(split);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const e = avg(early);
  const l = avg(late);
  if (e === 0) return l > 0 ? 100 : 0;
  return Math.round(Math.max(-100, Math.min(100, ((l - e) / e) * 100)));
}

export async function fetchGoogleTrendsSignals(
  workspace: WorkspaceConfig,
): Promise<SourceResult> {
  const started = Date.now();
  const geo = process.env.TRENDS_GEO ?? "US";
  const time = process.env.TRENDS_WINDOW ?? "now 7-d";
  const seeds = [workspace.niche, ...workspace.keywords].slice(0, 3);
  const signals: RawSignal[] = [];
  const errors: string[] = [];

  const perSeed = await Promise.allSettled(
    seeds.map(async (seed) => {
      const ex = await explore(seed, geo, time);
      const related = ex.widgets?.find((w) => w.id === "RELATED_QUERIES");
      const series = ex.widgets?.find((w) => w.id === "TIMESERIES");

      let momentum = 0;
      if (series?.token && series.request) {
        try {
          const ml = await widgetData<MultilineResponse>(
            "multiline",
            series.request,
            series.token,
          );
          momentum = seriesMomentum(
            (ml.default?.timelineData ?? []).map((p) => p.value?.[0] ?? 0),
          );
        } catch {
          /* momentum is a nice-to-have */
        }
      }

      if (!related?.token || !related.request) {
        throw new HttpError(`no RELATED_QUERIES widget returned for "${seed}"`);
      }

      const rs = await widgetData<RelatedSearchesResponse>(
        "relatedsearches",
        related.request,
        related.token,
      );
      // rankedList[0] = top queries (all-time popular), [1] = rising.
      const rising = rs.default?.rankedList?.[1]?.rankedKeyword ?? [];
      return { seed, rising, momentum };
    }),
  );

  for (const result of perSeed) {
    if (result.status === "rejected") {
      const err = result.reason;
      errors.push(err instanceof HttpError ? err.message : String(err));
      continue;
    }
    const { seed, rising, momentum } = result.value;
    for (const entry of rising.slice(0, 15)) {
      if (!entry.query) continue;
      const value = entry.value ?? 0;
      signals.push({
        source: "google_trends",
        title: entry.query,
        context: `Rising search query related to "${seed}".`,
        url: `${HOST}/trends/explore?q=${encodeURIComponent(entry.query)}&geo=${geo}`,
        metric: value,
        metricLabel:
          value >= 5000
            ? `Breakout search (+5000%) vs. last period`
            : `Search interest ${entry.formattedValue ?? `+${value}%`} vs. last period`,
        velocity: googleVelocity(value),
        meta: { seed, seedMomentum: momentum, rawValue: value },
      });
    }
  }

  const deduped = dedupeByTitle(signals).sort((a, b) => b.velocity - a.velocity);

  return {
    source: "google_trends",
    signals: deduped.slice(0, 30),
    error:
      deduped.length === 0 && errors.length
        ? `Google Trends unreachable: ${errors[0]}`
        : undefined,
    tookMs: Date.now() - started,
  };
}

function dedupeByTitle(signals: RawSignal[]): RawSignal[] {
  const seen = new Map<string, RawSignal>();
  for (const s of signals) {
    const key = s.title.toLowerCase().trim();
    const prev = seen.get(key);
    if (!prev || s.velocity > prev.velocity) seen.set(key, s);
  }
  return [...seen.values()];
}
