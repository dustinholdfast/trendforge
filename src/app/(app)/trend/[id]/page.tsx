import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GeneratePanel } from "@/components/generate-panel";
import { Badge, Card } from "@/components/ui";
import { isAiConfigured } from "@/lib/ai/provider";
import { getAssetsForTrend, getTrend, safeParse } from "@/lib/queries";
import { getActiveWorkspace, requireUserId } from "@/lib/session";
import { SOURCE_LABELS, type SourceId, type TrendEvidence } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) return null;

  const trend = await getTrend(workspace.id, id);
  if (!trend) notFound();

  const assets = await getAssetsForTrend(trend.id);
  const evidence = safeParse<TrendEvidence[]>(trend.evidence, []);
  const angles = safeParse<string[]>(trend.angles, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/feed"
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-mid)] transition-colors hover:text-[var(--color-hi)]"
      >
        <ArrowLeft size={13} /> Rising now
      </Link>

      <header className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={trend.score >= 75 ? "hot" : trend.score >= 55 ? "warm" : "neutral"}>
            score {trend.score}
          </Badge>
          <Badge tone="neutral">velocity {trend.velocity}</Badge>
          <Badge tone="neutral">relevance {trend.relevance}</Badge>
          <Badge tone="neutral">
            {SOURCE_LABELS[trend.primarySource as SourceId] ?? trend.primarySource}
          </Badge>
        </div>
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
          {trend.title}
        </h1>
        {trend.summary ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-mid)]">
            {trend.summary}
          </p>
        ) : null}
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {trend.why ? (
          <Card className="p-3.5">
            <p className="mb-1.5 text-[11px] tracking-wide text-[var(--color-lo)] uppercase">
              Why it&apos;s trending
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--color-hi)]">
              {trend.why}
            </p>
          </Card>
        ) : null}

        {angles.length ? (
          <Card className="p-3.5">
            <p className="mb-1.5 text-[11px] tracking-wide text-[var(--color-lo)] uppercase">
              Angles
            </p>
            <ul className="flex flex-col gap-1.5">
              {angles.map((angle, i) => (
                <li
                  key={i}
                  className="text-[13px] leading-relaxed text-[var(--color-mid)]"
                >
                  {angle}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {evidence.length ? (
        <div className="mb-7">
          <p className="mb-2 text-[11px] tracking-wide text-[var(--color-lo)] uppercase">
            Sources
          </p>
          <div className="flex flex-col gap-1.5">
            {evidence.map((e) => (
              <a
                key={e.url}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="mr-2 text-[11px] text-[var(--color-lo)]">
                    {SOURCE_LABELS[e.source as SourceId] ?? e.source}
                  </span>
                  <span className="text-[12.5px] text-[var(--color-mid)]">
                    {e.title}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-[var(--color-lo)]">
                    {e.metricLabel}
                  </span>
                  <ExternalLink
                    size={12}
                    className="text-[var(--color-lo)] transition-colors group-hover:text-[var(--color-hi)]"
                  />
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <GeneratePanel
        trendId={trend.id}
        aiReady={isAiConfigured()}
        initialAssets={assets.map((a) => ({
          id: a.id,
          kind: a.kind,
          platform: a.platform,
          title: a.title,
          payload: a.payload,
          status: a.status,
          scheduledFor: a.scheduledFor ? a.scheduledFor.toISOString() : null,
        }))}
      />
    </div>
  );
}
