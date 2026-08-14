"use client";

import { CalendarPlus, Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  AssetKind,
  CarouselContent,
  LinkedInContent,
  ScriptContent,
  ThreadContent,
} from "@/lib/content/schema";

export interface AssetDTO {
  id: string;
  kind: string;
  platform: string;
  title: string;
  payload: string;
  status: string;
  scheduledFor: string | null;
}

const KIND_LABEL: Record<string, string> = {
  hooks: "Hooks",
  thread: "X thread",
  linkedin: "LinkedIn post",
  script: "Video script",
  carousel: "Carousel",
};

const STATUS_TONE: Record<string, "neutral" | "accent" | "cool"> = {
  draft: "neutral",
  scheduled: "accent",
  used: "cool",
};

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked (non-https origin) — nothing useful to do */
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CharCount({ text, limit }: { text: string; limit: number }) {
  const over = text.length > limit;
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        over ? "text-[#ff7676]" : "text-[var(--color-lo)]",
      )}
    >
      {text.length}/{limit}
    </span>
  );
}

// ---------------------------------------------------------------------------

function HooksView({ hooks }: { hooks: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {hooks.map((hook, i) => (
        <li
          key={i}
          className="group flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] px-3 py-2.5"
        >
          <span className="mt-0.5 text-[11px] tabular-nums text-[var(--color-lo)]">
            {i + 1}
          </span>
          <p className="flex-1 text-[13.5px] leading-relaxed text-[var(--color-hi)]">
            {hook}
          </p>
          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={hook} label="" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ThreadView({ thread }: { thread: ThreadContent }) {
  return (
    <ol className="flex flex-col gap-2">
      {thread.tweets.map((tweet, i) => (
        <li
          key={i}
          className="group rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] px-3 py-2.5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[11px] tabular-nums text-[var(--color-lo)]">
              {i + 1}/{thread.tweets.length}
            </span>
            <p className="flex-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--color-hi)]">
              {tweet}
            </p>
          </div>
          <div className="mt-1.5 flex items-center justify-between pl-8">
            <CharCount text={tweet} limit={280} />
            <span className="opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={tweet} label="" />
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LinkedInView({ post }: { post: LinkedInContent }) {
  const firstLine = post.body.slice(0, 140);
  return (
    <div>
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] px-3.5 py-3">
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--color-hi)]">
          {post.body}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-[var(--color-lo)]">
          Preview cut: “{firstLine}
          {post.body.length > 140 ? "…" : ""}”
        </p>
        <CharCount text={post.body} limit={3000} />
      </div>
    </div>
  );
}

function ScriptView({ script }: { script: ScriptContent }) {
  const spokenWords = script.beats
    .map((b) => b.spoken.split(/\s+/).length)
    .reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge tone="neutral">{script.durationSeconds}s</Badge>
        <span className="text-[11px] text-[var(--color-lo)]">
          {spokenWords} words · ~
          {Math.round(spokenWords / Math.max(script.durationSeconds, 1) * 10) / 10}{" "}
          words/sec
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
        {script.beats.map((beat, i) => (
          <div
            key={i}
            className="grid grid-cols-[74px_1fr_1fr] gap-3 border-b border-[var(--color-line)] bg-[var(--color-raised)] px-3 py-2.5 last:border-b-0"
          >
            <span className="font-mono text-[11px] text-[var(--color-lo)]">
              {beat.timecode}
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--color-hi)]">
              {beat.spoken}
            </p>
            <p className="text-[12px] leading-relaxed text-[var(--color-mid)]">
              {beat.visual}
            </p>
          </div>
        ))}
      </div>
      {script.onScreenText?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {script.onScreenText.map((t, i) => (
            <Badge key={i} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CarouselView({ carousel }: { carousel: CarouselContent }) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="flex aspect-[4/5] w-[168px] shrink-0 flex-col justify-center rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-hover)] p-3">
          <p className="text-[13px] leading-snug font-semibold text-[var(--color-hi)]">
            {carousel.title}
          </p>
          <span className="mt-2 text-[10px] text-[var(--color-lo)]">Cover</span>
        </div>
        {carousel.slides.map((slide, i) => (
          <div
            key={i}
            className="flex aspect-[4/5] w-[168px] shrink-0 flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] p-3"
          >
            <p className="text-[12px] leading-snug font-semibold text-[var(--color-hi)]">
              {slide.heading}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--color-mid)]">
              {slide.body}
            </p>
            <span className="mt-auto text-[10px] text-[var(--color-lo)]">
              {i + 2}
            </span>
          </div>
        ))}
      </div>
      {carousel.caption ? (
        <p className="mt-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--color-mid)]">
          {carousel.caption}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function assetToPlainText(kind: string, payload: unknown): string {
  switch (kind) {
    case "hooks":
      return (payload as string[]).map((h, i) => `${i + 1}. ${h}`).join("\n\n");
    case "thread":
      return (payload as ThreadContent).tweets.join("\n\n---\n\n");
    case "linkedin":
      return (payload as LinkedInContent).body;
    case "script": {
      const s = payload as ScriptContent;
      return [
        `[${s.durationSeconds}s]`,
        ...s.beats.map((b) => `${b.timecode}\nVO: ${b.spoken}\nVISUAL: ${b.visual}`),
        s.onScreenText?.length ? `\nON SCREEN: ${s.onScreenText.join(" / ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "carousel": {
      const c = payload as CarouselContent;
      return [
        `COVER: ${c.title}`,
        ...c.slides.map((s, i) => `SLIDE ${i + 2}: ${s.heading}\n${s.body}`),
        c.caption ? `\nCAPTION:\n${c.caption}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    default:
      return JSON.stringify(payload, null, 2);
  }
}

export function AssetCard({
  asset,
  onChanged,
}: {
  asset: AssetDTO;
  onChanged?: (next: AssetDTO | null) => void;
}) {
  const [status, setStatus] = useState(asset.status);
  const [scheduledFor, setScheduledFor] = useState(asset.scheduledFor);
  const [busy, setBusy] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);

  let payload: unknown;
  try {
    payload = JSON.parse(asset.payload);
  } catch {
    payload = null;
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.asset.status);
        setScheduledFor(
          data.asset.scheduledFor
            ? new Date(data.asset.scheduledFor).toISOString()
            : null,
        );
        onChanged?.({ ...asset, ...data.asset });
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.ok) onChanged?.(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="tf-in overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-hi)]">
            {KIND_LABEL[asset.kind] ?? asset.kind}
          </span>
          <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <CopyButton text={assetToPlainText(asset.kind, payload)} />
          {scheduledFor || pickingDate ? (
            <input
              type="datetime-local"
              aria-label="Schedule"
              autoFocus={pickingDate && !scheduledFor}
              value={scheduledFor ? toLocalInput(scheduledFor) : ""}
              onBlur={() => setPickingDate(false)}
              onChange={(e) =>
                patch({
                  scheduledFor: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
              disabled={busy}
              className="h-7 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] px-2 text-[11.5px] text-[var(--color-mid)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setPickingDate(true)}
            >
              <CalendarPlus size={12} />
              Schedule
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => patch({ status: status === "used" ? "draft" : "used" })}
          >
            {status === "used" ? "Unmark" : "Mark used"}
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={remove}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {payload === null ? (
          <p className="text-[12.5px] text-[var(--color-lo)]">
            Could not read this asset&apos;s payload.
          </p>
        ) : asset.kind === "hooks" ? (
          <HooksView hooks={payload as string[]} />
        ) : asset.kind === "thread" ? (
          <ThreadView thread={payload as ThreadContent} />
        ) : asset.kind === "linkedin" ? (
          <LinkedInView post={payload as LinkedInContent} />
        ) : asset.kind === "script" ? (
          <ScriptView script={payload as ScriptContent} />
        ) : asset.kind === "carousel" ? (
          <CarouselView carousel={payload as CarouselContent} />
        ) : (
          <pre className="text-[12px] text-[var(--color-mid)]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}

export const KIND_ORDER: AssetKind[] = [
  "hooks",
  "thread",
  "linkedin",
  "script",
  "carousel",
];

/** `datetime-local` wants local wall-clock time, not a UTC ISO string. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
