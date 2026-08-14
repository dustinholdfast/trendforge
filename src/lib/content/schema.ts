import type { JsonSchema } from "@/lib/ai/provider";
import type { Platform, Style } from "@/lib/types";

export type AssetKind = "hooks" | "thread" | "linkedin" | "script" | "carousel";

export interface ThreadContent {
  tweets: string[];
}

export interface LinkedInContent {
  body: string;
}

export interface ScriptBeat {
  timecode: string;
  spoken: string;
  visual: string;
}

export interface ScriptContent {
  durationSeconds: number;
  beats: ScriptBeat[];
  onScreenText: string[];
}

export interface CarouselSlide {
  heading: string;
  body: string;
}

export interface CarouselContent {
  title: string;
  slides: CarouselSlide[];
  caption: string;
}

export interface GeneratedContent {
  hooks?: string[];
  thread?: ThreadContent;
  linkedin?: LinkedInContent;
  script?: ScriptContent;
  carousel?: CarouselContent;
}

export const ASSET_META: Record<
  AssetKind,
  { label: string; platform: Platform; blurb: string }
> = {
  hooks: { label: "Hooks", platform: "x", blurb: "3 opening lines" },
  thread: { label: "X thread", platform: "x", blurb: "5–8 posts" },
  linkedin: { label: "LinkedIn post", platform: "linkedin", blurb: "long-form" },
  script: { label: "Video script", platform: "shortform", blurb: "15–45s" },
  carousel: { label: "Carousel", platform: "linkedin", blurb: "title + slides" },
};

/** Which assets a workspace's platform + style settings ask for. */
export function selectedKinds(
  platforms: Platform[],
  styles: Style[],
): AssetKind[] {
  const kinds: AssetKind[] = [];
  if (styles.includes("hooks")) kinds.push("hooks");
  if (styles.includes("thread") && platforms.includes("x")) kinds.push("thread");
  if (platforms.includes("linkedin")) kinds.push("linkedin");
  if (styles.includes("script") && platforms.includes("shortform"))
    kinds.push("script");
  if (styles.includes("carousel")) kinds.push("carousel");
  return kinds.length ? kinds : ["hooks"];
}

const SECTION_SCHEMAS: Record<AssetKind, Record<string, unknown>> = {
  hooks: {
    type: "array",
    description:
      "Exactly 3 opening lines. Each must work as a standalone first line of a post — no setup, no 'in this thread'. Make the three structurally different from each other: one contrarian, one concrete-number, one story-open.",
    items: { type: "string" },
  },
  thread: {
    type: "object",
    additionalProperties: false,
    required: ["tweets"],
    properties: {
      tweets: {
        type: "array",
        description:
          "5-8 posts. Each under 280 characters, each able to stand alone. Post 1 is the hook. The last post lands a takeaway — no 'follow me for more'. Do not number them; do not use hashtags.",
        items: { type: "string" },
      },
    },
  },
  linkedin: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: {
        type: "string",
        description:
          "900-1400 characters. Opens with a line that survives the 'see more' truncation at ~140 chars. Short paragraphs separated by blank lines. Ends with a real question, not a CTA. No hashtags, no emoji bullets, no 'Agree?'.",
      },
    },
  },
  script: {
    type: "object",
    additionalProperties: false,
    required: ["durationSeconds", "beats", "onScreenText"],
    properties: {
      durationSeconds: {
        type: "integer",
        description: "Total runtime, between 15 and 45.",
      },
      beats: {
        type: "array",
        description:
          "4-7 beats covering the full runtime. The first beat must earn the next 3 seconds.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["timecode", "spoken", "visual"],
          properties: {
            timecode: { type: "string", description: "e.g. '0:00-0:03'" },
            spoken: {
              type: "string",
              description:
                "Exactly what is said. Spoken register — contractions, short sentences. ~2.5 words per second of runtime.",
            },
            visual: {
              type: "string",
              description:
                "What is on screen: shot, b-roll, screen recording, or graphic. Be specific enough to shoot without asking a follow-up question.",
            },
          },
        },
      },
      onScreenText: {
        type: "array",
        description: "3-5 short text overlays, in order. Under 6 words each.",
        items: { type: "string" },
      },
    },
  },
  carousel: {
    type: "object",
    additionalProperties: false,
    required: ["title", "slides", "caption"],
    properties: {
      title: {
        type: "string",
        description: "Cover slide headline. Under 10 words.",
      },
      slides: {
        type: "array",
        description:
          "4-6 content slides after the cover. One idea per slide, building in sequence.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["heading", "body"],
          properties: {
            heading: { type: "string", description: "Under 8 words." },
            body: {
              type: "string",
              description: "1-2 sentences, under 200 characters.",
            },
          },
        },
      },
      caption: {
        type: "string",
        description: "The accompanying post caption, 2-4 sentences.",
      },
    },
  },
};

export function buildContentSchema(kinds: AssetKind[]): JsonSchema {
  const properties: Record<string, unknown> = {};
  for (const kind of kinds) properties[kind] = SECTION_SCHEMAS[kind];
  return {
    type: "object",
    additionalProperties: false,
    required: [...kinds],
    properties,
  };
}

// ---------------------------------------------------------------------------
// Validation — the API guarantees shape, this guards against empty/degenerate
// output (e.g. a 2-post "thread") before it reaches the user.
// ---------------------------------------------------------------------------

export function validateContent(
  content: GeneratedContent,
  kinds: AssetKind[],
): string[] {
  const problems: string[] = [];
  for (const kind of kinds) {
    switch (kind) {
      case "hooks":
        if (!content.hooks?.length) problems.push("no hooks returned");
        break;
      case "thread":
        if ((content.thread?.tweets?.length ?? 0) < 4)
          problems.push("thread too short");
        break;
      case "linkedin":
        if ((content.linkedin?.body?.length ?? 0) < 200)
          problems.push("linkedin post too short");
        break;
      case "script":
        if ((content.script?.beats?.length ?? 0) < 3)
          problems.push("script has too few beats");
        break;
      case "carousel":
        if ((content.carousel?.slides?.length ?? 0) < 3)
          problems.push("carousel has too few slides");
        break;
    }
  }
  return problems;
}

/** Splits one generation into individually schedulable assets. */
export function toAssetRows(content: GeneratedContent, trendTitle: string) {
  const rows: Array<{
    kind: AssetKind;
    platform: Platform;
    title: string;
    payload: unknown;
  }> = [];

  if (content.hooks?.length) {
    rows.push({
      kind: "hooks",
      platform: "x",
      title: `Hooks — ${trendTitle}`,
      payload: content.hooks,
    });
  }
  if (content.thread?.tweets?.length) {
    rows.push({
      kind: "thread",
      platform: "x",
      title: `X thread — ${trendTitle}`,
      payload: content.thread,
    });
  }
  if (content.linkedin?.body) {
    rows.push({
      kind: "linkedin",
      platform: "linkedin",
      title: `LinkedIn — ${trendTitle}`,
      payload: content.linkedin,
    });
  }
  if (content.script?.beats?.length) {
    rows.push({
      kind: "script",
      platform: "shortform",
      title: `Video script — ${trendTitle}`,
      payload: content.script,
    });
  }
  if (content.carousel?.slides?.length) {
    rows.push({
      kind: "carousel",
      platform: "linkedin",
      title: `Carousel — ${trendTitle}`,
      payload: content.carousel,
    });
  }
  return rows;
}
