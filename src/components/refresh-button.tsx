"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { SOURCE_LABELS, type SourceId } from "@/lib/types";

interface SourceStatus {
  source: SourceId;
  count: number;
  error?: string;
  needsConfig?: boolean;
  tookMs: number;
}

export function RefreshButton({
  workspaceId,
  label = "Refresh",
}: {
  workspaceId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<SourceStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/trends/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setStatuses(data.sources ?? null);
      if (data.degraded) setNote(data.degraded);
      if (data.count === 0 && !data.degraded) {
        setNote(
          "No trends came back. Check the source status below — Reddit and Google Trends both rate-limit aggressively.",
        );
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={refresh} disabled={working} variant="primary">
        <RefreshCw size={13} className={working ? "animate-spin" : undefined} />
        {working ? "Scanning sources…" : label}
      </Button>

      {statuses ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {statuses.map((s) => (
            <span
              key={s.source}
              title={s.error ?? `${s.count} signals in ${s.tookMs}ms`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] px-1.5 py-0.5 text-[11px] text-[var(--color-mid)]"
            >
              <span
                className="size-1.5 rounded-full"
                style={{
                  background: s.needsConfig
                    ? "var(--color-lo)"
                    : s.error
                      ? "#ff7676"
                      : s.count > 0
                        ? "var(--color-cool)"
                        : "var(--color-warm)",
                }}
              />
              {SOURCE_LABELS[s.source]} {s.count}
            </span>
          ))}
        </div>
      ) : null}

      {note ? (
        <p className="max-w-md text-right text-[11.5px] leading-relaxed text-[var(--color-warm)]">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-md text-right text-[11.5px] text-[#ff7676]">{error}</p>
      ) : null}
      {statuses?.some((s) => s.error) ? (
        <p className="max-w-md text-right text-[11.5px] leading-relaxed text-[var(--color-lo)]">
          {statuses.find((s) => s.error)?.error}
        </p>
      ) : null}
    </div>
  );
}
