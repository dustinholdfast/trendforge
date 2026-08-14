import { CalendarView } from "@/components/calendar-view";
import { getScheduled } from "@/lib/queries";
import { getActiveWorkspace, requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const userId = await requireUserId();
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) return null;

  const scheduled = await getScheduled(workspace.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Calendar</h1>
        <p className="mt-1 text-[13px] text-[var(--color-mid)]">
          {scheduled.length} scheduled {scheduled.length === 1 ? "post" : "posts"}.
          Set dates from any asset in the Library.
        </p>
      </header>

      <CalendarView
        items={scheduled
          .filter((a) => a.scheduledFor)
          .map((a) => ({
            id: a.id,
            kind: a.kind,
            title: a.title,
            status: a.status,
            trendId: a.trendId,
            scheduledFor: a.scheduledFor!.toISOString(),
          }))}
      />
    </div>
  );
}
