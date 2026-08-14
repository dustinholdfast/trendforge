import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import type { TrendView } from "@/lib/queries";
import { SOURCE_LABELS, type SourceId } from "@/lib/types";

function scoreTone(score: number) {
  if (score >= 75) return "hot" as const;
  if (score >= 55) return "warm" as const;
  return "neutral" as const;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[58px] shrink-0 text-[11px] text-[var(--color-lo)]">
        {label}
      </span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--color-raised)]">
        <span
          className="block h-full rounded-full bg-[var(--color-line-strong)]"
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </span>
      <span className="w-6 text-right text-[11px] tabular-nums text-[var(--color-mid)]">
        {value}
      </span>
    </div>
  );
}

export function TrendCard({ trend, rank }: { trend: TrendView; rank: number }) {
  const sources = [...new Set(trend.evidence.map((e) => e.source))];

  return (
    <Card className="group tf-in overflow-hidden transition-colors hover:border-[var(--color-line-strong)]">
      <Link href={`/trend/${trend.id}`} className="block p-4">
        <div className="flex items-start gap-4">
          <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
            <span
              className={
                "text-[17px] font-semibold tabular-nums " +
                (trend.score >= 75
                  ? "text-[var(--color-hot)]"
                  : trend.score >= 55
                    ? "text-[var(--color-warm)]"
                    : "text-[var(--color-mid)]")
              }
            >
              {trend.score}
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--color-lo)]">
              #{rank}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[14.5px] leading-snug font-medium text-[var(--color-hi)]">
                {trend.title}
              </h3>
              <ArrowUpRight
                size={15}
                className="mt-0.5 shrink-0 text-[var(--color-lo)] transition-colors group-hover:text-[var(--color-hi)]"
              />
            </div>

            {trend.why ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-mid)]">
                {trend.why}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Meter label="Velocity" value={trend.velocity} />
              <Meter label="Relevance" value={trend.relevance} />

              <div className="flex flex-wrap gap-1.5">
                {sources.map((s) => (
                  <Badge key={s} tone="neutral">
                    {SOURCE_LABELS[s as SourceId] ?? s}
                  </Badge>
                ))}
                {trend.assetCount > 0 ? (
                  <Badge tone="accent">
                    <Sparkles size={10} />
                    {trend.assetCount} asset
                    {trend.assetCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Link>

      {trend.evidence.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-line)] px-4 py-2">
          {trend.evidence.slice(0, 3).map((e) => (
            <a
              key={e.url}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[11.5px] text-[var(--color-lo)] transition-colors hover:text-[var(--color-mid)]"
            >
              {e.metricLabel}
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
