/**
 * Pings each trend source with a sample niche and reports what came back.
 * Run this first when the feed looks empty:
 *
 *   npm run check:sources -- "indie SaaS"
 */
import "dotenv/config";
import { fetchGoogleTrendsSignals } from "../src/lib/sources/google-trends";
import { fetchRedditSignals } from "../src/lib/sources/reddit";
import { fetchXSignals } from "../src/lib/sources/x";
import type { WorkspaceConfig } from "../src/lib/types";

const niche = process.argv[2] ?? "AI productivity tools";

const workspace: WorkspaceConfig = {
  id: "check",
  niche,
  keywords: [],
  platforms: ["x", "linkedin", "shortform"],
  styles: ["hooks", "thread", "carousel", "script"],
  subreddits: [],
};

async function main() {
  console.log(`Checking sources for niche: "${niche}"\n`);

  const results = await Promise.all([
    fetchRedditSignals(workspace),
    fetchGoogleTrendsSignals(workspace),
    fetchXSignals(workspace),
  ]);

  for (const r of results) {
    const status = r.needsConfig
      ? "⚙ not configured"
      : r.error
        ? "✗ failed"
        : r.signals.length
          ? "✓ ok"
          : "⚠ no signals";
    console.log(`${status}  ${r.source}  (${r.tookMs}ms, ${r.signals.length} signals)`);
    if (r.error) console.log(`   ${r.error}`);
    for (const s of r.signals.slice(0, 3)) {
      console.log(`   · [v${s.velocity}] ${s.title.slice(0, 90)}`);
    }
    console.log();
  }

  const working = results.filter((r) => r.signals.length > 0).length;
  console.log(`${working}/3 sources returned data.`);
  if (working === 0) {
    console.log(
      "\nAll three empty. Most common causes:\n" +
        "  · Reddit rate-limited an anonymous request — set REDDIT_CLIENT_ID/SECRET.\n" +
        "  · Google Trends returned 429 — wait a minute and retry.\n" +
        "  · X needs a paid API plan — set X_BEARER_TOKEN.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
