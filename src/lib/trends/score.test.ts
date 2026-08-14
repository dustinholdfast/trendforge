import { describe, expect, it } from "vitest";
import type { RawSignal, WorkspaceConfig } from "@/lib/types";
import {
  blendScore,
  clusterVelocity,
  dedupeKey,
  distinctSources,
  heuristicRelevance,
  prefilterSignals,
  primarySource,
  tokenize,
} from "./score";

const workspace: WorkspaceConfig = {
  id: "w1",
  niche: "AI productivity tools",
  keywords: ["notion", "second brain"],
  platforms: ["x", "linkedin", "shortform"],
  styles: ["hooks", "thread", "carousel", "script"],
  subreddits: ["productivity"],
};

function signal(over: Partial<RawSignal> = {}): RawSignal {
  return {
    source: "reddit",
    title: "Something happened",
    url: "https://example.com/1",
    metric: 100,
    metricLabel: "100 upvotes",
    velocity: 50,
    ...over,
  };
}

describe("tokenize", () => {
  it("drops stopwords and punctuation", () => {
    expect(tokenize("The best AI tools for a team!")).toEqual([
      "tools",
      "team",
    ]);
  });

  it("strips urls", () => {
    expect(tokenize("check https://x.com/abc notion")).toEqual(["check", "notion"]);
  });
});

describe("heuristicRelevance", () => {
  it("scores on-topic signals above off-topic ones", () => {
    const onTopic = heuristicRelevance(
      signal({ title: "Notion's new AI productivity features" }),
      workspace,
    );
    const offTopic = heuristicRelevance(
      signal({ title: "My sourdough starter finally worked" }),
      workspace,
    );
    expect(onTopic).toBeGreaterThan(offTopic);
  });

  it("gives Google Trends signals a relevance floor", () => {
    const score = heuristicRelevance(
      signal({ source: "google_trends", title: "totally unrelated phrase" }),
      workspace,
    );
    expect(score).toBeGreaterThanOrEqual(55);
  });

  it("credits posts from a tracked subreddit", () => {
    const score = heuristicRelevance(
      signal({ title: "unrelated words here", meta: { subreddit: "productivity" } }),
      workspace,
    );
    expect(score).toBeGreaterThanOrEqual(45);
  });

  it("returns a neutral score when the niche has no usable tokens", () => {
    const score = heuristicRelevance(signal(), {
      ...workspace,
      niche: "the a",
      keywords: [],
    });
    expect(score).toBe(50);
  });
});

describe("blendScore", () => {
  it("weights velocity above relevance", () => {
    expect(blendScore(100, 0, 1)).toBeGreaterThan(blendScore(0, 100, 1));
  });

  it("rewards corroboration across sources", () => {
    expect(blendScore(60, 60, 3)).toBeGreaterThan(blendScore(60, 60, 1));
  });

  it("caps the corroboration bonus at two extra sources", () => {
    expect(blendScore(50, 50, 3)).toBe(blendScore(50, 50, 5));
  });

  it("never exceeds 100", () => {
    expect(blendScore(100, 100, 3)).toBe(100);
  });
});

describe("clusterVelocity", () => {
  it("is driven by the strongest member", () => {
    expect(clusterVelocity([signal({ velocity: 90 })])).toBe(68);
  });

  it("rises when more members corroborate", () => {
    const solo = clusterVelocity([signal({ velocity: 80 })]);
    const backed = clusterVelocity([
      signal({ velocity: 80 }),
      signal({ velocity: 70 }),
      signal({ velocity: 60 }),
    ]);
    expect(backed).toBeGreaterThan(solo);
  });

  it("handles an empty cluster", () => {
    expect(clusterVelocity([])).toBe(0);
  });
});

describe("source helpers", () => {
  it("reports distinct sources", () => {
    expect(
      distinctSources([
        signal({ source: "reddit" }),
        signal({ source: "reddit" }),
        signal({ source: "x" }),
      ]),
    ).toEqual(["reddit", "x"]);
  });

  it("picks the source behind the fastest-moving member", () => {
    expect(
      primarySource([
        signal({ source: "reddit", velocity: 20 }),
        signal({ source: "google_trends", velocity: 90 }),
      ]),
    ).toBe("google_trends");
  });
});

describe("prefilterSignals", () => {
  it("keeps high-velocity signals even when off-topic", () => {
    const noise = signal({ title: "completely unrelated thing", velocity: 95 });
    const picked = prefilterSignals([noise], workspace);
    expect(picked).toHaveLength(1);
  });

  it("drops low-velocity off-topic noise", () => {
    const noise = signal({ title: "completely unrelated thing", velocity: 5 });
    expect(prefilterSignals([noise], workspace)).toHaveLength(0);
  });

  it("stops one source from crowding out the others", () => {
    const reddit = Array.from({ length: 40 }, (_, i) =>
      signal({ title: `notion thing ${i}`, velocity: 90, url: `u${i}` }),
    );
    const trends = Array.from({ length: 10 }, (_, i) =>
      signal({
        source: "google_trends",
        title: `rising query ${i}`,
        velocity: 40,
        url: `g${i}`,
      }),
    );
    const picked = prefilterSignals([...reddit, ...trends], workspace, 20);
    const bySource = picked.filter((s) => s.source === "google_trends");
    expect(bySource.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(20);
  });
});

describe("dedupeKey", () => {
  it("matches reworded titles with the same content words", () => {
    expect(dedupeKey("Notion launches AI agents")).toBe(
      dedupeKey("AI agents launches Notion"),
    );
  });

  it("separates genuinely different topics", () => {
    expect(dedupeKey("Notion launches AI agents")).not.toBe(
      dedupeKey("Figma launches design agents"),
    );
  });
});
