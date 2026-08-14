import { describe, expect, it } from "vitest";
import {
  buildContentSchema,
  selectedKinds,
  toAssetRows,
  validateContent,
  type GeneratedContent,
} from "./schema";

describe("selectedKinds", () => {
  it("returns everything when all platforms and styles are on", () => {
    expect(
      selectedKinds(
        ["x", "linkedin", "shortform"],
        ["hooks", "thread", "carousel", "script"],
      ),
    ).toEqual(["hooks", "thread", "linkedin", "script", "carousel"]);
  });

  it("drops the thread when X is off", () => {
    const kinds = selectedKinds(["linkedin"], ["hooks", "thread"]);
    expect(kinds).not.toContain("thread");
  });

  it("drops the script when short-form is off", () => {
    expect(selectedKinds(["x"], ["script"])).not.toContain("script");
  });

  it("never returns an empty set", () => {
    expect(selectedKinds(["x"], [])).toEqual(["hooks"]);
  });
});

describe("buildContentSchema", () => {
  it("only asks for the selected sections", () => {
    const schema = buildContentSchema(["hooks", "linkedin"]);
    expect(Object.keys(schema.properties)).toEqual(["hooks", "linkedin"]);
    expect(schema.required).toEqual(["hooks", "linkedin"]);
  });

  it("is OpenAI strict-mode safe at every level", () => {
    const schema = buildContentSchema([
      "hooks",
      "thread",
      "linkedin",
      "script",
      "carousel",
    ]);
    const objects: Record<string, unknown>[] = [];
    (function walk(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "object") objects.push(n);
      for (const value of Object.values(n)) {
        if (Array.isArray(value)) value.forEach(walk);
        else walk(value);
      }
    })(schema);

    expect(objects.length).toBeGreaterThan(3);
    for (const obj of objects) {
      expect(obj.additionalProperties).toBe(false);
      const props = Object.keys((obj.properties ?? {}) as object);
      expect([...(obj.required as string[])].sort()).toEqual(props.sort());
    }
  });
});

const full: GeneratedContent = {
  hooks: ["a", "b", "c"],
  thread: { tweets: ["1", "2", "3", "4", "5"] },
  linkedin: { body: "x".repeat(400) },
  script: {
    durationSeconds: 30,
    beats: [
      { timecode: "0:00-0:05", spoken: "hi", visual: "shot" },
      { timecode: "0:05-0:15", spoken: "mid", visual: "shot" },
      { timecode: "0:15-0:30", spoken: "end", visual: "shot" },
    ],
    onScreenText: ["one", "two"],
  },
  carousel: {
    title: "t",
    slides: [
      { heading: "h1", body: "b" },
      { heading: "h2", body: "b" },
      { heading: "h3", body: "b" },
    ],
    caption: "c",
  },
};

describe("validateContent", () => {
  it("passes complete output", () => {
    expect(
      validateContent(full, ["hooks", "thread", "linkedin", "script", "carousel"]),
    ).toEqual([]);
  });

  it("flags a stub thread", () => {
    const problems = validateContent(
      { ...full, thread: { tweets: ["only", "two"] } },
      ["thread"],
    );
    expect(problems).toContain("thread too short");
  });

  it("flags a too-short LinkedIn post", () => {
    expect(validateContent({ linkedin: { body: "hi" } }, ["linkedin"])).toContain(
      "linkedin post too short",
    );
  });

  it("only checks the kinds that were requested", () => {
    expect(validateContent({ hooks: ["a"] }, ["hooks"])).toEqual([]);
  });
});

describe("toAssetRows", () => {
  it("splits a generation into one row per asset", () => {
    const rows = toAssetRows(full, "Some trend");
    expect(rows.map((r) => r.kind)).toEqual([
      "hooks",
      "thread",
      "linkedin",
      "script",
      "carousel",
    ]);
    expect(rows.every((r) => r.title.includes("Some trend"))).toBe(true);
  });

  it("skips sections that came back empty", () => {
    const rows = toAssetRows({ hooks: ["a"] }, "T");
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe("x");
  });

  it("routes each asset to the right platform", () => {
    const rows = toAssetRows(full, "T");
    expect(rows.find((r) => r.kind === "script")?.platform).toBe("shortform");
    expect(rows.find((r) => r.kind === "carousel")?.platform).toBe("linkedin");
  });
});
