import Link from "next/link";
import { authProviders } from "@/auth";
import { Card } from "@/components/ui";

export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card className="p-5">
        <h1 className="text-[16px] font-semibold">
          {authProviders.smtp ? "Check your email" : "Check your terminal"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-mid)]">
          {authProviders.smtp
            ? "We sent you a sign-in link. It expires in 15 minutes."
            : "No SMTP server is configured, so the sign-in link was printed to the terminal running `npm run dev`. Paste it into your browser."}
        </p>
        <Link
          href="/signin"
          className="mt-4 inline-block text-[12.5px] text-[var(--color-accent)] hover:underline"
        >
          Back to sign in
        </Link>
      </Card>
    </div>
  );
}
