import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "nodemailer"],
  typescript: {
    // Type errors are caught by `npm run typecheck` in CI; don't block local builds.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
