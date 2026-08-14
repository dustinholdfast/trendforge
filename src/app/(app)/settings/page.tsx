import { WorkspaceFormCard } from "@/components/workspace-form";
import { Card } from "@/components/ui";
import { isAiConfigured, resolveModel, resolveProvider } from "@/lib/ai/provider";
import { getActiveWorkspace, requireUserId, toWorkspaceConfig } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const row = await getActiveWorkspace(userId);
  if (!row) return null;
  const config = toWorkspaceConfig(row);

  let aiLine = "Not configured — add ANTHROPIC_API_KEY or OPENAI_API_KEY.";
  if (isAiConfigured()) {
    const provider = resolveProvider();
    aiLine = `${provider} · ${resolveModel(provider)}`;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-[var(--color-mid)]">
          Tune what gets scanned and what gets written.
        </p>
      </header>

      <WorkspaceFormCard
        mode="edit"
        initial={{
          id: config.id,
          niche: config.niche,
          keywords: config.keywords,
          platforms: config.platforms,
          styles: config.styles,
          subreddits: config.subreddits,
          brandVoice: config.brandVoice ?? "",
        }}
      />

      <Card className="mt-4 p-4">
        <p className="mb-2 text-[11px] tracking-wide text-[var(--color-lo)] uppercase">
          Environment
        </p>
        <dl className="flex flex-col gap-1.5 text-[12.5px]">
          <Row label="AI provider" value={aiLine} />
          <Row
            label="X / Twitter"
            value={
              process.env.X_BEARER_TOKEN
                ? "Bearer token set"
                : "No token — source skipped (X has no free read tier)"
            }
          />
          <Row
            label="Reddit"
            value={
              process.env.REDDIT_CLIENT_ID
                ? "App credentials set"
                : "Anonymous — works, but rate-limits sooner"
            }
          />
          <Row label="Google Trends" value="Keyless (unofficial endpoints)" />
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--color-lo)]">{label}</dt>
      <dd className="text-right text-[var(--color-mid)]">{value}</dd>
    </div>
  );
}
