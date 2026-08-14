"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea, Toggle } from "@/components/ui";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  STYLES,
  STYLE_LABELS,
  type Platform,
  type Style,
} from "@/lib/types";

export interface WorkspaceFormValues {
  id?: string;
  niche: string;
  keywords: string[];
  platforms: Platform[];
  styles: Style[];
  subreddits: string[];
  brandVoice: string;
}

const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function WorkspaceForm({
  initial,
  mode,
}: {
  initial: WorkspaceFormValues;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [niche, setNiche] = useState(initial.niche);
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [subreddits, setSubreddits] = useState(initial.subreddits.join(", "));
  const [platforms, setPlatforms] = useState<Platform[]>(initial.platforms);
  const [styles, setStyles] = useState<Style[]>(initial.styles);
  const [brandVoice, setBrandVoice] = useState(initial.brandVoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    );
  }

  async function submit() {
    if (niche.trim().length < 2) {
      setError("Give it a niche first.");
      return;
    }
    if (platforms.length === 0) {
      setError("Pick at least one platform.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);

    const body = {
      niche: niche.trim(),
      keywords: splitList(keywords),
      subreddits: splitList(subreddits).map((s) => s.replace(/^\/?r\//, "")),
      platforms,
      styles,
      brandVoice: brandVoice.trim() || null,
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/workspaces" : `/api/workspaces/${initial.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");

      if (mode === "create") {
        // Kick off the first scan so the feed isn't empty on arrival.
        fetch("/api/trends/refresh", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId: data.workspace.id }),
        }).catch(() => {});
        router.push("/feed");
        router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>Niche</Label>
        <Input
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. AI productivity tools for solo founders"
          autoFocus={mode === "create"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && mode === "create") submit();
          }}
        />
        <p className="mt-1.5 text-[11.5px] text-[var(--color-lo)]">
          Be specific. &ldquo;Personal finance for millennials&rdquo; beats
          &ldquo;finance&rdquo; — the whole ranking pass leans on this.
        </p>
      </div>

      <div>
        <Label>Keywords</Label>
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="comma separated — notion, second brain, note taking"
        />
      </div>

      <div>
        <Label>Subreddits</Label>
        <Input
          value={subreddits}
          onChange={(e) => setSubreddits(e.target.value)}
          placeholder="leave empty and Reddit will be asked to suggest some"
        />
      </div>

      <div>
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <Toggle
              key={p}
              active={platforms.includes(p)}
              onClick={() => toggle(platforms, p, setPlatforms)}
            >
              {PLATFORM_LABELS[p]}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <Label>Content styles</Label>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <Toggle
              key={s}
              active={styles.includes(s)}
              onClick={() => toggle(styles, s, setStyles)}
            >
              {STYLE_LABELS[s]}
            </Toggle>
          ))}
        </div>
      </div>

      <div>
        <Label>Your voice</Label>
        <Textarea
          rows={3}
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          placeholder="Optional. e.g. Dry, technical, allergic to hype. Writes from 10 years running infra teams."
        />
      </div>

      {error ? <p className="text-[12.5px] text-[#ff7676]">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy
            ? "Saving…"
            : mode === "create"
              ? "Create workspace & scan"
              : "Save changes"}
        </Button>
        {saved ? (
          <span className="text-[12.5px] text-[var(--color-cool)]">Saved</span>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceFormCard(props: {
  initial: WorkspaceFormValues;
  mode: "create" | "edit";
}) {
  return (
    <Card className="p-5">
      <WorkspaceForm {...props} />
    </Card>
  );
}
