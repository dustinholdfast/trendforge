"use client";

import { useMemo, useState } from "react";
import { AssetCard, type AssetDTO } from "@/components/asset-view";
import { EmptyState, Toggle } from "@/components/ui";

const STATUSES = ["all", "draft", "scheduled", "used"] as const;
const KINDS = ["all", "hooks", "thread", "linkedin", "script", "carousel"] as const;

const KIND_LABEL: Record<string, string> = {
  all: "All types",
  hooks: "Hooks",
  thread: "Threads",
  linkedin: "LinkedIn",
  script: "Scripts",
  carousel: "Carousels",
};

export function LibraryView({ initial }: { initial: AssetDTO[] }) {
  const [assets, setAssets] = useState(initial);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");

  const filtered = useMemo(
    () =>
      assets.filter(
        (a) =>
          (status === "all" || a.status === status) &&
          (kind === "all" || a.kind === kind),
      ),
    [assets, status, kind],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { draft: 0, scheduled: 0, used: 0 };
    for (const a of assets) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [assets]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Toggle key={s} active={status === s} onClick={() => setStatus(s)}>
            {s === "all" ? `All ${assets.length}` : `${s} ${counts[s] ?? 0}`}
          </Toggle>
        ))}
        <span className="mx-1 w-px self-stretch bg-[var(--color-line)]" />
        {KINDS.map((k) => (
          <Toggle key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Toggle>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing here"
          body="Generated content shows up here. Pick a trend from Rising now and generate a set."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onChanged={(next) =>
                setAssets((prev) =>
                  next
                    ? prev.map((a) => (a.id === asset.id ? next : a))
                    : prev.filter((a) => a.id !== asset.id),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
