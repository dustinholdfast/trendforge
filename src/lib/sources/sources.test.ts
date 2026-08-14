import { describe, expect, it } from "vitest";
import { stripXssi } from "@/lib/http";
import type { WorkspaceConfig } from "@/lib/types";
import { googleVelocity, seriesMomentum } from "./google-trends";
import { redditVelocity } from "./reddit";
import { buildQuery, xVelocity } from "./x";

const workspace: WorkspaceConfig = {
  id: "w1",
  niche: "indie SaaS",
  keywords: ["bootstrapped", "micro saas"],
  platforms: ["x"],
  styles: ["thread"],
  subreddits: [],
};

describe("stripXssi", () => {
  it("removes Google's anti-hijacking prefix", () => {
    expect(stripXssi(")]}'\n{\"a\":1}")).toBe('{"a":1}');
  });

  it("handles array payloads", () => {
    expect(stripXssi(")]}',\n[1,2]")).toBe("[1,2]");
  });

  it("leaves clean JSON alone", () => {
    expect(stripXssi('{"a":1}')).toBe('{"a":1}');
  });
});

describe("redditVelocity", () => {
  it("rewards fast accumulation over raw score", () => {
    const fast = redditVelocity(1000, 2);
    const slow = redditVelocity(1000, 40);
    expect(fast).toBeGreaterThan(slow);
  });

  it("clamps to 0-100", () => {
    expect(redditVelocity(5_000_000, 0.1)).toBe(100);
    expect(redditVelocity(0, 100)).toBe(0);
  });

  it("does not divide by zero on brand new posts", () => {
    expect(Number.isFinite(redditVelocity(50, 0))).toBe(true);
  });
});

describe("googleVelocity", () => {
  it("treats breakout as the ceiling", () => {
    expect(googleVelocity(5000)).toBe(100);
    expect(googleVelocity(99999)).toBe(100);
  });

  it("is monotonic", () => {
    expect(googleVelocity(500)).toBeGreaterThan(googleVelocity(50));
  });
});

describe("seriesMomentum", () => {
  it("is positive for a rising series", () => {
    expect(seriesMomentum([10, 10, 10, 10, 30, 30])).toBeGreaterThan(0);
  });

  it("is negative for a falling series", () => {
    expect(seriesMomentum([50, 50, 50, 50, 10, 10])).toBeLessThan(0);
  });

  it("returns 0 for series too short to judge", () => {
    expect(seriesMomentum([1, 2, 3])).toBe(0);
  });

  it("handles an all-zero early window without NaN", () => {
    expect(seriesMomentum([0, 0, 0, 0, 5, 5])).toBe(100);
  });
});

describe("xVelocity", () => {
  it("weights reposts and bookmarks above likes", () => {
    const likesOnly = xVelocity(
      { like_count: 100, retweet_count: 0, reply_count: 0, quote_count: 0 },
      5,
    );
    const spread = xVelocity(
      { like_count: 0, retweet_count: 100, reply_count: 0, quote_count: 0 },
      5,
    );
    expect(spread).toBeGreaterThan(likesOnly);
  });

  it("stays within 0-100", () => {
    const v = xVelocity(
      {
        like_count: 1e6,
        retweet_count: 1e6,
        reply_count: 1e6,
        quote_count: 1e6,
        bookmark_count: 1e6,
      },
      0.1,
    );
    expect(v).toBe(100);
  });
});

describe("buildQuery", () => {
  it("quotes multi-word terms and ORs them", () => {
    const q = buildQuery(workspace);
    expect(q).toContain('"indie SaaS"');
    expect(q).toContain(" OR ");
  });

  it("filters out retweets and replies", () => {
    expect(buildQuery(workspace)).toContain("-is:retweet -is:reply");
  });

  it("does not wrap a single term in parentheses", () => {
    const q = buildQuery({ ...workspace, keywords: [] });
    expect(q.startsWith('"indie SaaS"')).toBe(true);
  });
});
