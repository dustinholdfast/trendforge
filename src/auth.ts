import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { db, schema } from "@/db";

/**
 * Auth.js v5.
 *
 * Two ways in, both optional to configure:
 *  - Google OAuth — set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
 *  - Email magic link — set EMAIL_SERVER (SMTP URL) + EMAIL_FROM.
 *
 * With neither configured the email flow still works: the sign-in link is
 * printed to the terminal instead of being mailed, so you can run the whole
 * app locally before touching a single OAuth console. That fallback is
 * refused in production.
 */

const hasGoogle = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);
const hasSmtp = Boolean(process.env.EMAIL_SERVER);
const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
    authenticatorsTable: schema.authenticators,
  }),
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email" },
  providers: [
    ...(hasGoogle
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Nodemailer({
      server: process.env.EMAIL_SERVER ?? "smtp://localhost:1025",
      from: process.env.EMAIL_FROM ?? "TrendForge <noreply@trendforge.local>",
      maxAge: 15 * 60,
      async sendVerificationRequest(params) {
        if (hasSmtp) {
          const { createTransport } = await import("nodemailer");
          const transport = createTransport(params.provider.server);
          await transport.sendMail({
            to: params.identifier,
            from: params.provider.from,
            subject: "Your TrendForge sign-in link",
            text: `Sign in to TrendForge:\n${params.url}\n\nThis link expires in 15 minutes.`,
            html: magicLinkEmail(params.url),
          });
          return;
        }
        if (isProd) {
          throw new Error(
            "EMAIL_SERVER is not configured — refusing to print sign-in links in production.",
          );
        }
        console.log(
          [
            "",
            "┌─────────────────────────────────────────────────────────────",
            "│ TrendForge dev sign-in link (no EMAIL_SERVER configured)",
            `│ for: ${params.identifier}`,
            "│",
            `│ ${params.url}`,
            "└─────────────────────────────────────────────────────────────",
            "",
          ].join("\n"),
        );
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

export const authProviders = { google: hasGoogle, email: true, smtp: hasSmtp };

function magicLinkEmail(url: string): string {
  return `<body style="background:#0b0b0f;padding:40px 0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="440" cellpadding="0" cellspacing="0" style="background:#141419;border:1px solid #26262e;border-radius:14px;padding:32px">
      <tr><td style="color:#fafafa;font-size:18px;font-weight:600;padding-bottom:8px">Sign in to TrendForge</td></tr>
      <tr><td style="color:#a1a1aa;font-size:14px;line-height:20px;padding-bottom:24px">Click below to finish signing in. The link expires in 15 minutes.</td></tr>
      <tr><td><a href="${url}" style="display:inline-block;background:#fafafa;color:#0b0b0f;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">Sign in</a></td></tr>
      <tr><td style="color:#52525b;font-size:12px;padding-top:24px">If you didn't request this, you can ignore it.</td></tr>
    </table>
  </td></tr></table>
</body>`;
}
