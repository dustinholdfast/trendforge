import { formatDistanceToNow } from "date-fns";
import { RefreshButton } from "@/components/refresh-button";
import { TrendCard } from "@/components/trend-card";
import { EmptyState } from "@/components/ui";
import { isAiConfigured } from "@/lib/ai/provider";
import { getFeed } from "@/lib/queries";
import { getActiveWorkspace, requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const userId = await requireUserId();
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) return null;

  const trends = await getFeed(workspace.id);
  const aiReady = isAiConfigured();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Rising now</h1>
          <p className="mt-1 text-[13px] text-[var(--color-mid)]">
            {workspace.niche}
            {workspace.lastRefreshedAt ? (
              <span className="text-[var(--color-lo)]">
                {" · updated "}
                {formatDistanceToNow(workspace.lastRefreshedAt, {
                  addSuffix: true,
                })}
              </span>
            ) : null}
          </p>
        </div>
        <RefreshButton workspaceId={workspace.id} />
      </header>

      {!aiReady ? (
        <div className="mb-5 rounded-[var(--radius-card)] border border-[color-mix(in_oklab,var(--color-warm)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-warm)_7%,transparent)] px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--color-warm)]">
            No AI key configured. Add <code>ANTHROPIC_API_KEY</code> or{" "}
            <code>OPENAI_API_KEY</code> to <code>.env.local</code> — without one,
            trends fall back to raw signals and content generation is disabled.
          </p>
        </div>
      ) : null}

      {trends.length === 0 ? (
        <EmptyState
          title="Nothing scanned yet"
          body="Hit refresh to pull rising topics from Reddit, Google Trends and X for this niche. First scan usually takes 10–20 seconds."
          action={<RefreshButton workspaceId={workspace.id} label="Scan now" />}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {trends.map((trend, i) => (
            <TrendCard key={trend.id} trend={trend} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
