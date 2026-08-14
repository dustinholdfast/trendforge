import { redirect } from "next/navigation";
import { WorkspaceFormCard } from "@/components/workspace-form";
import { getActiveWorkspace, getCurrentUserId } from "@/lib/session";
import { PLATFORMS, STYLES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");
  const existing = await getActiveWorkspace(userId);
  if (existing) redirect("/feed");

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-6">
        <span className="grid size-7 place-items-center rounded-md bg-[var(--color-hi)] text-[14px] font-bold text-[var(--color-canvas)]">
          T
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight">
          What are you making content about?
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-mid)]">
          TrendForge watches Reddit, Google Trends and X for what&apos;s rising in
          your corner of the internet, then turns it into posts you can ship.
        </p>
      </div>

      <WorkspaceFormCard
        mode="create"
        initial={{
          niche: "",
          keywords: [],
          platforms: [...PLATFORMS],
          styles: [...STYLES],
          subreddits: [],
          brandVoice: "",
        }}
      />
    </div>
  );
}
