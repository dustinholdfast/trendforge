# TrendForge

Watches Reddit, Google Trends and X for what's rising in your niche, ranks it by
velocity and relevance, and turns any topic into platform-ready content in one
pass: hooks, an X thread, a LinkedIn post, a short-form video script, and a
carousel.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Drizzle + SQLite
(libSQL) · Auth.js v5 · Anthropic or OpenAI, switchable.

---

## Run it

```bash
npm install
cp .env.example .env.local     # fill in AUTH_SECRET + one AI key
npm run db:migrate
npm run dev
```

Then open http://localhost:3000.

Three env vars get you a working app:

```bash
DATABASE_URL="file:./trendforge.db"
AUTH_SECRET="…"                # npx auth secret
ANTHROPIC_API_KEY="sk-ant-…"   # or OPENAI_API_KEY
```

**Signing in with nothing configured.** Enter any email on the sign-in screen.
With no SMTP server set, the magic link is printed to the terminal running
`npm run dev` — paste it into the browser. Set `EMAIL_SERVER` / `EMAIL_FROM` to
send real mail, or `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` for Google OAuth
(callback URL: `http://localhost:3000/api/auth/callback/google`). The terminal
fallback throws in production rather than leaking links.

---

## The loop

1. **Onboarding** — enter a niche. If you don't name subreddits, Reddit is asked
   which ones match.
2. **Refresh** — all three sources are hit in parallel. Each failure degrades on
   its own; one dead source doesn't kill the scan.
3. **Rank** — raw signals get a cheap keyword pre-filter, then one LLM pass
   clusters them into distinct topics and scores relevance. Velocity is computed
   from the data, never from the model.
4. **Generate** — pick a trend, get five assets in one structured call.
5. **Workspace** — save, schedule on a calendar, mark used.

### How ranking works

`score = 0.55 × velocity + 0.45 × relevance + 6 per corroborating source (max 2)`

- **Velocity** is per-source rate-of-change, normalised to 0-100:
  - Reddit: upvotes per hour, log-compressed so a niche sub and a default sub are
    comparable.
  - Google Trends: the rising-query percentage, with "Breakout" as the ceiling.
  - X: weighted engagement per hour — reposts and bookmarks count more than
    likes, which are the cheapest action on the platform.
- **Relevance** is the model's 0-100 judgement against your niche, after a
  keyword pre-filter that keeps recall high.
- **Corroboration** rewards topics rising in more than one place at once.

All of this is pure functions in `src/lib/trends/score.ts`, unit-tested, so feed
order is explainable rather than vibes.

---

## Sources

| Source | Key needed | Notes |
| --- | --- | --- |
| Reddit | Optional | Works anonymously; rate-limits fast. A free "script" app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` makes it reliable. |
| Google Trends | None | Drives the same undocumented endpoints the Trends site uses. Keyless, but Google 429s under load. |
| X / Twitter | **Required** | `X_BEARER_TOKEN`. X has no free read tier — recent search needs a paid plan. Without a token the source is skipped cleanly and everything else still works. |

When the feed looks empty:

```bash
npm run check:sources -- "your niche here"
```

It pings each source and tells you exactly which one is failing and why.

---

## AI provider

Auto-detected from whichever key is present; force it with
`AI_PROVIDER=anthropic|openai`. Defaults are `claude-sonnet-5` and `gpt-5.6`,
overridable with `AI_MODEL`.

Both providers are driven through one interface in `src/lib/ai/provider.ts`:
you pass a JSON Schema, you get a parsed object back. Anthropic uses a forced
tool call, OpenAI uses `response_format: json_schema` in strict mode. The model
is never asked to "return JSON" in the prompt, so there is no repair pass and no
parse failure path.

The generation prompt is in `src/lib/content/generate.ts`. That prompt is the
product — it's written as craft rules per platform plus a banned-phrase list, and
it's the first thing to edit if the output doesn't sound like you. Your
`brandVoice` from Settings is injected into every call.

---

## Testing

```bash
npm test        # 50 unit tests: ranking math, source parsers, schema validation
npm run build   # required before smoke
npm run smoke   # end-to-end: seeds a DB, stubs the LLM, drives the full loop
```

`npm run smoke` stands up the production server against a throwaway database and
a fake OpenAI endpoint, then checks auth, refresh degradation, generation,
asset persistence, scheduling, ownership isolation, and that every page renders.
It never touches your real data.

---

## Project layout

```
src/
  app/
    (app)/            feed · trend/[id] · library · calendar · settings
    api/              trends/refresh · generate · assets/[id] · workspaces
    onboarding/  signin/
  components/         ui primitives, trend card, asset renderers, calendar
  db/                 drizzle schema + client
  lib/
    ai/provider.ts    anthropic + openai behind one structured-output interface
    content/          generation prompt, output schema, asset splitting
    sources/          reddit · google-trends · x adapters
    trends/           score.ts (pure, tested) · discover.ts (orchestration)
scripts/              migrate · check-sources · smoke
```

---

## Known limits

- **X costs money.** Nothing to be done about that; the adapter is ready the day
  you add a token.
- **Google Trends is unofficial.** Google can change or throttle those endpoints
  without notice. Failures degrade to "source returned nothing" rather than
  breaking the scan.
- **Refresh is synchronous.** A scan takes 10-20s and runs in the request. Fine
  for one user; move it to a queue or a cron route before you have many.
- **No posting integration.** Scheduling marks intent — it does not publish. That
  is deliberate for an MVP; publishing means per-platform OAuth and review.
- **SQLite by default.** Swap `DATABASE_URL` for a Turso/libSQL URL to go remote
  with no code changes; Postgres would need a Drizzle dialect switch.

## Next things worth building

1. Move refresh to a background job with a cron route, so the feed is warm before
   you open it.
2. Per-asset inline editing — right now you copy out and edit elsewhere.
3. A "more like this" signal: learn from which trends you actually generate from
   and weight relevance accordingly.
4. Publishing for at least LinkedIn, where the API is the least painful.
"# trendforge" 
