"use client";

import { Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssetCard, KIND_ORDER, type AssetDTO } from "@/components/asset-view";
import { Button, Card, EmptyState, Input } from "@/components/ui";

interface GenerateMeta {
  provider: string;
  model: string;
  latencyMs: number;
  warnings: string[];
}

export function GeneratePanel({
  trendId,
  initialAssets,
  aiReady,
}: {
  trendId: string;
  initialAssets: AssetDTO[];
  aiReady: boolean;
}) {
  const [assets, setAssets] = useState<AssetDTO[]>(initialAssets);
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [steer, setSteer] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => clearInterval(timer.current ?? undefined), []);

  async function generate(regenerate: boolean) {
    setGenerating(true);
    setError(null);
    setElapsed(0);
    const startedAt = Date.now();
    timer.current = setInterval(
      () => setElapsed((Date.now() - startedAt) / 1000),
      100,
    );
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trendId,
          regenerate,
          steer: steer.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setAssets(
        regenerate ? data.assets : [...data.assets, ...assets],
      );
      setMeta({
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        warnings: data.warnings ?? [],
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearInterval(timer.current ?? undefined);
      setGenerating(false);
    }
  }

  const sorted = [...assets].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind as never) - KIND_ORDER.indexOf(b.kind as never),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => generate(assets.length > 0)}
            disabled={generating || !aiReady}
          >
            <Wand2 size={13} />
            {generating
              ? `Writing… ${elapsed.toFixed(1)}s`
              : assets.length
                ? "Regenerate"
                : "Generate content"}
          </Button>
          {assets.length > 0 ? (
            <Input
              value={steer}
              onChange={(e) => setSteer(e.target.value)}
              placeholder="Steer it — e.g. 'punchier, more skeptical'"
              className="h-9 w-[280px]"
            />
          ) : null}
        </div>

        {meta ? (
          <p className="text-[11.5px] text-[var(--color-lo)]">
            {(meta.latencyMs / 1000).toFixed(1)}s · {meta.provider}/{meta.model}
          </p>
        ) : null}
      </div>

      {!aiReady ? (
        <p className="mb-4 text-[12.5px] text-[var(--color-warm)]">
          Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local to enable
          generation.
        </p>
      ) : null}

      {error ? (
        <Card className="mb-4 border-[color-mix(in_oklab,#ff7676_40%,transparent)] p-3">
          <p className="text-[12.5px] text-[#ff7676]">{error}</p>
        </Card>
      ) : null}

      {meta?.warnings.length ? (
        <p className="mb-4 text-[11.5px] text-[var(--color-warm)]">
          Quality check: {meta.warnings.join(", ")}. Try regenerating.
        </p>
      ) : null}

      {generating && assets.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="tf-skeleton h-28 rounded-[var(--radius-card)] border border-[var(--color-line)]"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No content yet"
          body="Generate hooks, an X thread, a LinkedIn post, a short-form script and a carousel from this trend in one pass."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((asset) => (
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

      {generating && assets.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--color-mid)]">
          <Sparkles size={12} /> Rewriting… {elapsed.toFixed(1)}s
        </p>
      ) : null}
    </div>
  );
}
