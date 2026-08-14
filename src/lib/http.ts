export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
  /** Strip Google's `)]}',` XSSI prefix before parsing. */
  stripXssiPrefix?: boolean;
}

const DEFAULT_UA =
  process.env.TRENDFORGE_USER_AGENT ??
  "TrendForge/0.1 (+https://github.com/; content research tool)";

export async function fetchText(
  url: string,
  { timeoutMs = 12_000, ...init }: FetchJsonOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": DEFAULT_UA,
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new HttpError(
        `${res.status} ${res.statusText} for ${new URL(url).host}`,
        res.status,
      );
    }
    return await res.text();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new HttpError(`timed out after ${timeoutMs}ms`, 408);
    }
    throw new HttpError((err as Error)?.message ?? "network error");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const text = await fetchText(url, options);
  const body = options.stripXssiPrefix ? stripXssi(text) : text;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(
      `response from ${new URL(url).host} was not JSON (${body.slice(0, 80)}…)`,
    );
  }
}

/** Google prefixes API responses with `)]}'` or `)]}',` to defeat JSON hijacking. */
export function stripXssi(text: string): string {
  const idx = text.indexOf("{");
  const arrIdx = text.indexOf("[");
  const start =
    idx === -1 ? arrIdx : arrIdx === -1 ? idx : Math.min(idx, arrIdx);
  return start > 0 ? text.slice(start) : text;
}

/** Runs promises in parallel, never rejecting — failures become `null`. */
export async function settle<T>(tasks: Promise<T>[]): Promise<(T | null)[]> {
  const results = await Promise.allSettled(tasks);
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}
