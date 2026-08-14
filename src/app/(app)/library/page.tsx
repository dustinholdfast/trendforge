import { LibraryView } from "@/components/library-view";
import { getLibrary } from "@/lib/queries";
import { getActiveWorkspace, requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const userId = await requireUserId();
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) return null;

  const assets = await getLibrary(workspace.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-[13px] text-[var(--color-mid)]">
          Everything you&apos;ve generated for {workspace.niche}.
        </p>
      </header>

      <LibraryView
        initial={assets.map((a) => ({
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
