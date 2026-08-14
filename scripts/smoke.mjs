/**
 * End-to-end smoke test of the core loop, with the LLM stubbed.
 *
 *   node scripts/smoke.mjs
 *
 * It seeds a user + session + workspace + trend straight into SQLite, stands up
 * a fake OpenAI-compatible endpoint, boots the production server against it,
 * then drives: generate -> assets persisted -> schedule -> library renders.
 *
 * Requires a production build first (`npm run build`). Uses its own database
 * file so it never touches your real data.
 */
import { createClient } from "@libsql/client";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

/** libSQL leaves -wal/-shm alongside the db; a stale WAL corrupts the next run. */
function removeDb() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    rmSync(`${DB_FILE}${suffix}`, { force: true });
  }
}

const DB = "file:./smoke.db";
const DB_FILE = "./smoke.db";
const MOCK_PORT = 4599;
const APP_PORT = 3111;
const BASE = `http://127.0.0.1:${APP_PORT}`;

const CONTENT = {
  hooks: [
    "The pricing page changed and nobody noticed the part that matters.",
    "Three IDEs shipped the same integration in nine days. That is not a coincidence.",
    "I rewrote the integration twice before I understood what it was actually for.",
  ],
  thread: {
    tweets: [
      "Three IDEs shipped the same integration in nine days. That is not a coincidence.",
      "The spec landed in November. By February, everyone had a client.",
      "What changed: the transport got simpler. One less thing to argue about.",
      "The interesting part is not the protocol. It is that nobody had to agree on a model.",
      "If you are building tooling, the window where this is a differentiator is closing.",
    ],
  },
  linkedin: {
    body:
      "Three IDEs shipped the same integration in nine days.\n\n".padEnd(60, " ") +
      "\n\nThat is not a coincidence, and it is not marketing. The spec landed in November and by February there were four independent clients.\n\nWhat actually changed was the transport. It got simple enough that nobody had to argue about it in review.\n\nThe part I keep thinking about: none of these teams had to agree on a model provider to agree on this.\n\nWhat is the last integration you shipped because it stopped being annoying?",
  },
  script: {
    durationSeconds: 30,
    beats: [
      {
        timecode: "0:00-0:04",
        spoken: "Three editors shipped the same thing in nine days.",
        visual: "Screen recording: three release notes pages, quick cuts",
      },
      {
        timecode: "0:04-0:15",
        spoken:
          "The spec came out in November. By February everyone had a client. That never happens.",
        visual: "Timeline graphic with four logos appearing",
      },
      {
        timecode: "0:15-0:24",
        spoken: "What changed is the transport got boring. Boring is why it spread.",
        visual: "Side-by-side diff of the old and new transport config",
      },
      {
        timecode: "0:24-0:30",
        spoken: "If you build tooling, that window is closing.",
        visual: "Talking head, direct to camera",
      },
    ],
    onScreenText: ["9 days", "4 clients", "boring wins"],
  },
  carousel: {
    title: "Why four IDEs shipped the same thing at once",
    slides: [
      { heading: "The spec landed in November", body: "One document, no vendor attached." },
      { heading: "Four clients by February", body: "Independent teams, no coordination." },
      { heading: "The transport got boring", body: "Boring means nobody argues in review." },
      { heading: "That is the whole story", body: "Adoption follows the path of least argument." },
    ],
    caption:
      "Four independent implementations in three months. The interesting part is not the protocol.",
  },
};

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function startMockAi() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const requested = Object.keys(
          parsed.response_format?.json_schema?.schema?.properties ?? {},
        );
        const payload = Object.fromEntries(
          requested.map((k) => [k, CONTENT[k]]).filter(([, v]) => v !== undefined),
        );
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          }),
        );
      });
    });
    server.listen(MOCK_PORT, () => resolve(server));
  });
}

async function seed() {
  removeDb();
  const client = createClient({ url: DB });

  await new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
      { env: { ...process.env, DATABASE_URL: DB }, stdio: "inherit" },
    );
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("migrate failed"))));
  });

  const userId = randomUUID();
  const sessionToken = randomUUID();
  const workspaceId = randomUUID();
  const trendId = randomUUID();
  const now = Date.now();

  await client.execute({
    sql: "insert into user (id, name, email, emailVerified) values (?, ?, ?, ?)",
    args: [userId, "Smoke Test", `smoke-${now}@example.com`, now],
  });
  await client.execute({
    sql: "insert into session (sessionToken, userId, expires) values (?, ?, ?)",
    args: [sessionToken, userId, now + 86_400_000],
  });
  await client.execute({
    sql: `insert into workspace (id, user_id, name, niche, keywords, platforms, styles, subreddits, created_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      workspaceId,
      userId,
      "MCP tooling",
      "AI developer tooling",
      JSON.stringify(["mcp", "ide", "agents"]),
      JSON.stringify(["x", "linkedin", "shortform"]),
      JSON.stringify(["hooks", "thread", "carousel", "script"]),
      JSON.stringify(["localllama"]),
      now,
    ],
  });
  await client.execute({
    sql: `insert into trend (id, workspace_id, title, summary, primary_source, evidence, velocity, relevance, score, why, angles, dedupe_key, discovered_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      trendId,
      workspaceId,
      "Four IDEs shipped MCP clients in one quarter",
      "Independent editor teams all shipped support for the same integration spec within three months of its release.",
      "reddit",
      JSON.stringify([
        {
          source: "reddit",
          title: "Every editor now speaks MCP",
          url: "https://www.reddit.com/r/localllama/comments/example",
          metricLabel: "2.4k upvotes in 11h",
        },
      ]),
      82,
      91,
      88,
      "A fourth editor shipped support this week, three months after the spec landed.",
      JSON.stringify(["Adoption follows the path of least argument"]),
      "clients-ides-mcp-quarter-shipped",
      now,
    ],
  });

  client.close();
  return { userId, sessionToken, workspaceId, trendId };
}

function startApp() {
  // Spawn next directly rather than via npx: killing npx leaves the server
  // orphaned, and the next run then talks to a stale process.
  const proc = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: DB,
        AUTH_SECRET: "smoke-test-secret-not-for-production",
        AUTH_URL: BASE,
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-smoke-test",
        OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  proc.stderr.on("data", (d) => {
    const text = String(d);
    if (/error/i.test(text)) process.stderr.write(`    [app] ${text}`);
  });
  return proc;
}

async function waitForServer(timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/signin`);
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  console.log("→ seeding database");
  const { sessionToken, trendId, workspaceId } = await seed();

  console.log("→ starting mock AI endpoint");
  const mock = await startMockAi();

  console.log("→ starting app");
  const app = startApp();

  try {
    const up = await waitForServer();
    if (!up) throw new Error("server did not come up — did you run `npm run build`?");

    const cookie = `authjs.session-token=${sessionToken}`;
    const json = (path, init = {}) =>
      fetch(`${BASE}${path}`, {
        ...init,
        headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) },
      });

    console.log("\nauth");
    const anon = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trendId }),
    });
    check("rejects unauthenticated generate", anon.status === 401, `got ${anon.status}`);

    console.log("\nrefresh (sources may be unreachable — should degrade, not throw)");
    const refreshRes = await json("/api/trends/refresh", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    const refresh = await refreshRes.json();
    check("refresh returns 200", refreshRes.ok, `got ${refreshRes.status}`);
    check("refresh reports per-source status", Array.isArray(refresh.sources));
    check(
      "unreachable sources surface an error instead of crashing",
      refresh.sources?.every((s) => s.count > 0 || s.error || s.needsConfig),
    );

    console.log("\ngenerate");
    const started = Date.now();
    const genRes = await json("/api/generate", {
      method: "POST",
      body: JSON.stringify({ trendId }),
    });
    const gen = await genRes.json();
    check("generate returns 200", genRes.ok, JSON.stringify(gen).slice(0, 200));
    check("produced 5 assets", gen.assets?.length === 5, `got ${gen.assets?.length}`);
    check("no quality warnings", (gen.warnings ?? []).length === 0, String(gen.warnings));
    check(
      "round trip under 15s",
      Date.now() - started < 15_000,
      `${Date.now() - started}ms`,
    );
    check(
      "asset kinds are complete",
      ["hooks", "thread", "linkedin", "script", "carousel"].every((k) =>
        gen.assets?.some((a) => a.kind === k),
      ),
    );
    check(
      "payloads are stored as JSON strings",
      gen.assets?.every((a) => typeof a.payload === "string" && a.payload.length > 10),
    );

    console.log("\nscheduling");
    const asset = gen.assets[0];
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const patchRes = await json(`/api/assets/${asset.id}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledFor: when }),
    });
    const patched = await patchRes.json();
    check("schedule returns 200", patchRes.ok);
    check("status flips to scheduled", patched.asset?.status === "scheduled");

    const usedRes = await json(`/api/assets/${asset.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "used" }),
    });
    check("mark used returns 200", usedRes.ok);
    check("status is used", (await usedRes.json()).asset?.status === "used");

    console.log("\npages");
    for (const path of ["/feed", "/library", "/calendar", "/settings", `/trend/${trendId}`]) {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
      const html = await res.text();
      check(`${path} renders`, res.ok, `status ${res.status}`);
      if (path === "/library") {
        check("library shows generated content", html.includes("LinkedIn"));
      }
      if (path === `/trend/${trendId}`) {
        check("trend page shows the topic", html.includes("Four IDEs shipped"));
      }
    }

    console.log("\nownership");
    const otherRes = await json(`/api/assets/${randomUUID()}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "used" }),
    });
    check("unknown asset id is 404", otherRes.status === 404, `got ${otherRes.status}`);

    console.log(
      failures === 0
        ? "\n✓ smoke test passed"
        : `\n✗ ${failures} check(s) failed`,
    );
  } finally {
    app.kill();
    mock.close();
    removeDb();
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
