export const PLATFORMS = ["x", "linkedin", "shortform"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const STYLES = ["hooks", "thread", "carousel", "script"] as const;
export type Style = (typeof STYLES)[number];

export const SOURCES = ["reddit", "google_trends", "x"] as const;
export type SourceId = (typeof SOURCES)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X / Twitter",
  linkedin: "LinkedIn",
  shortform: "Short-form video",
};

export const STYLE_LABELS: Record<Style, string> = {
  hooks: "Hooks",
  thread: "Threads",
  carousel: "Carousels",
  script: "Video scripts",
};

export const SOURCE_LABELS: Record<SourceId, string> = {
  reddit: "Reddit",
  google_trends: "Google Trends",
  x: "X / Twitter",
};

/** A single raw hit from one source, before dedupe and ranking. */
export interface RawSignal {
  source: SourceId;
  /** Human-readable topic phrase. */
  title: string;
  /** Optional longer context — post body, related query set, etc. */
  context?: string;
  url: string;
  /** Absolute engagement/interest figure, source-specific. */
  metric: number;
  /** Human label for `metric`, e.g. "1.2k upvotes in 9h". */
  metricLabel: string;
  /** Rate-of-change proxy, normalized 0-100 by the source adapter. */
  velocity: number;
  createdAt?: Date;
  /** Anything the ranking or prompt layer may find useful. */
  meta?: Record<string, unknown>;
}

/** One source's contribution to a merged trend. */
export interface TrendEvidence {
  source: SourceId;
  title: string;
  url: string;
  metricLabel: string;
}

/** A trend after dedupe + scoring, before it hits the database. */
export interface ScoredTrend {
  dedupeKey: string;
  title: string;
  summary: string;
  primarySource: SourceId;
  evidence: TrendEvidence[];
  velocity: number;
  relevance: number;
  score: number;
  why: string;
  angles: string[];
  context: string;
}

export interface SourceResult {
  source: SourceId;
  signals: RawSignal[];
  /** Set when the source could not be reached or is not configured. */
  error?: string;
  /** True when the source needs credentials the user has not supplied. */
  needsConfig?: boolean;
  tookMs: number;
}

export interface WorkspaceConfig {
  id: string;
  niche: string;
  keywords: string[];
  platforms: Platform[];
  styles: Style[];
  subreddits: string[];
  brandVoice?: string | null;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
