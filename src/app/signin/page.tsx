import { redirect } from "next/navigation";
import { authProviders, signIn } from "@/auth";
import { Card } from "@/components/ui";
import { getCurrentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUserId()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6">
        <span className="grid size-7 place-items-center rounded-md bg-[var(--color-hi)] text-[14px] font-bold text-[var(--color-canvas)]">
          T
        </span>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">
          Sign in to TrendForge
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-mid)]">
          Rising topics in your niche, turned into posts.
        </p>
      </div>

      <Card className="p-5">
        {authProviders.google ? (
          <>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="h-9 w-full rounded-lg bg-[var(--color-hi)] text-[13px] font-medium text-[var(--color-canvas)] transition-opacity hover:opacity-90"
              >
                Continue with Google
              </button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--color-line)]" />
              <span className="text-[11px] text-[var(--color-lo)]">or</span>
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>
          </>
        ) : null}

        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("nodemailer", {
              email: String(formData.get("email") ?? ""),
              redirectTo: "/",
            });
          }}
          className="flex flex-col gap-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="h-9 w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] px-3 text-[13px] text-[var(--color-hi)] placeholder:text-[var(--color-lo)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="h-9 w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-raised)] text-[13px] font-medium transition-colors hover:bg-[var(--color-hover)]"
          >
            Email me a sign-in link
          </button>
        </form>

        {!authProviders.smtp ? (
          <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--color-lo)]">
            No SMTP configured, so the sign-in link is printed in your terminal
            instead of emailed. Fine for local dev — set{" "}
            <code className="text-[var(--color-mid)]">EMAIL_SERVER</code> before
            deploying.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-[12px] text-[#ff7676]">
            Sign-in failed ({error}). Check your provider config.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
