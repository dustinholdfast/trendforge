import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const cuid = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Auth.js tables (shape required by @auth/drizzle-adapter)
// ---------------------------------------------------------------------------

export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const authenticators = sqliteTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: integer("credentialBackedUp", {
      mode: "boolean",
    }).notNull(),
    transports: text("transports"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.credentialID] })],
);

// ---------------------------------------------------------------------------
// TrendForge tables
// ---------------------------------------------------------------------------

/** One niche the user tracks. A user can have several. */
export const workspaces = sqliteTable(
  "workspace",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    niche: text("niche").notNull(),
    /** JSON string[] — extra keywords that sharpen relevance scoring. */
    keywords: text("keywords").notNull().default("[]"),
    /** JSON string[] — "x" | "linkedin" | "shortform" */
    platforms: text("platforms").notNull().default('["x","linkedin","shortform"]'),
    /** JSON string[] — "hooks" | "thread" | "carousel" | "script" */
    styles: text("styles").notNull().default('["hooks","thread","carousel","script"]'),
    /** JSON string[] — subreddits polled for this niche. */
    subreddits: text("subreddits").notNull().default("[]"),
    /** Freeform voice notes injected into every generation prompt. */
    brandVoice: text("brand_voice"),
    lastRefreshedAt: integer("last_refreshed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("workspace_user_idx").on(t.userId)],
);

/** A rising topic, deduped across sources. */
export const trends = sqliteTable(
  "trend",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    /** "reddit" | "google_trends" | "x" — heaviest contributing source. */
    primarySource: text("primary_source").notNull(),
    /** JSON TrendEvidence[] */
    evidence: text("evidence").notNull().default("[]"),
    velocity: integer("velocity").notNull().default(0),
    relevance: integer("relevance").notNull().default(0),
    score: integer("score").notNull().default(0),
    /** Short "why this is trending" rationale shown in the feed. */
    why: text("why").notNull().default(""),
    /** JSON string[] — content angles for this topic. */
    angles: text("angles").notNull().default("[]"),
    /** Stable key used for cross-refresh dedupe. */
    dedupeKey: text("dedupe_key").notNull(),
    discoveredAt: integer("discovered_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("trend_workspace_dedupe_idx").on(t.workspaceId, t.dedupeKey),
    index("trend_workspace_score_idx").on(t.workspaceId, t.score),
  ],
);

/** One content-generation run against a trend. */
export const generations = sqliteTable(
  "generation",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    trendId: text("trend_id")
      .notNull()
      .references(() => trends.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    /** JSON GeneratedContent — full payload, kept for regeneration/debug. */
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("generation_workspace_idx").on(t.workspaceId, t.createdAt)],
);

/** An individual, schedulable piece of content. */
export const contentAssets = sqliteTable(
  "content_asset",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    trendId: text("trend_id").references(() => trends.id, {
      onDelete: "set null",
    }),
    generationId: text("generation_id").references(() => generations.id, {
      onDelete: "set null",
    }),
    /** "hooks" | "thread" | "linkedin" | "script" | "carousel" */
    kind: text("kind").notNull(),
    /** "x" | "linkedin" | "shortform" */
    platform: text("platform").notNull(),
    title: text("title").notNull(),
    /** JSON — shape depends on `kind`. See src/lib/content/schema.ts */
    payload: text("payload").notNull(),
    /** "draft" | "scheduled" | "used" */
    status: text("status").notNull().default("draft"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("asset_workspace_status_idx").on(t.workspaceId, t.status),
    index("asset_workspace_scheduled_idx").on(t.workspaceId, t.scheduledFor),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Trend = typeof trends.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type ContentAsset = typeof contentAssets.$inferSelect;
