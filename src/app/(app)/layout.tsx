import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";
import { Nav } from "@/components/nav";
import {
  getActiveWorkspace,
  getCurrentUserId,
  listWorkspaces,
} from "@/lib/session";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");

  const [session, workspace, workspaces] = await Promise.all([
    auth(),
    getActiveWorkspace(userId),
    listWorkspaces(userId),
  ]);
  if (!workspace) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-4 md:flex">
        <Link href="/feed" className="mb-5 flex items-center gap-2 px-2.5">
          <span className="grid size-6 place-items-center rounded-md bg-[var(--color-hi)] text-[13px] font-bold text-[var(--color-canvas)]">
            T
          </span>
          <span className="text-[13.5px] font-semibold tracking-tight">
            TrendForge
          </span>
        </Link>

        <div className="mb-4 px-2.5">
          <p className="text-[11px] tracking-wide text-[var(--color-lo)] uppercase">
            Niche
          </p>
          <p className="mt-1 truncate text-[13px] text-[var(--color-hi)]">
            {workspace.niche}
          </p>
          {workspaces.length > 1 ? (
            <p className="mt-0.5 text-[11px] text-[var(--color-lo)]">
              {workspaces.length} workspaces
            </p>
          ) : null}
        </div>

        <Nav />

        <div className="mt-auto border-t border-[var(--color-line)] pt-3">
          <p className="truncate px-2.5 text-[12px] text-[var(--color-mid)]">
            {session?.user?.email ?? "Signed in"}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--color-lo)] transition-colors hover:bg-[var(--color-raised)] hover:text-[var(--color-hi)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
