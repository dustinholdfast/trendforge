"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface CalendarItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  scheduledFor: string;
  trendId: string | null;
}

const KIND_SHORT: Record<string, string> = {
  hooks: "Hooks",
  thread: "Thread",
  linkedin: "LinkedIn",
  script: "Script",
  carousel: "Carousel",
};

export function CalendarView({ items }: { items: CalendarItem[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = format(new Date(item.scheduledFor), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const selectedItems = selected
    ? (byDay.get(format(selected, "yyyy-MM-dd")) ?? [])
    : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-medium">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            size="sm"
            variant="default"
            aria-label="Previous month"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeft size={13} />
          </Button>
          <Button
            size="sm"
            variant="default"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight size={13} />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--color-line)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-[10.5px] tracking-wide text-[var(--color-lo)] uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayItems = byDay.get(key) ?? [];
            const outside = !isSameMonth(day, cursor);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "min-h-[86px] border-r border-b border-[var(--color-line)] p-1.5 text-left transition-colors last:border-r-0",
                  outside && "opacity-35",
                  selected && isSameDay(day, selected)
                    ? "bg-[var(--color-hover)]"
                    : "hover:bg-[var(--color-raised)]",
                )}
              >
                <span
                  className={cn(
                    "inline-grid size-5 place-items-center rounded-md text-[11px] tabular-nums",
                    isToday(day)
                      ? "bg-[var(--color-hi)] font-semibold text-[var(--color-canvas)]"
                      : "text-[var(--color-mid)]",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10.5px]",
                        item.status === "used"
                          ? "bg-[color-mix(in_oklab,var(--color-cool)_16%,transparent)] text-[var(--color-cool)]"
                          : "bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-[var(--color-accent)]",
                      )}
                    >
                      {KIND_SHORT[item.kind] ?? item.kind}
                    </span>
                  ))}
                  {dayItems.length > 3 ? (
                    <span className="px-1 text-[10px] text-[var(--color-lo)]">
                      +{dayItems.length - 3} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selected ? (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-[var(--color-mid)]">
            {format(selected, "EEEE, d MMMM")}
            {selectedItems.length === 0 ? " — nothing scheduled" : ""}
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedItems.map((item) => (
              <Link
                key={item.id}
                href={item.trendId ? `/trend/${item.trendId}` : "/library"}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2 transition-colors hover:border-[var(--color-line-strong)]"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-hi)]">
                  {item.title}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-[var(--color-lo)]">
                    {format(new Date(item.scheduledFor), "HH:mm")}
                  </span>
                  <Badge tone={item.status === "used" ? "cool" : "accent"}>
                    {item.status}
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
