import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim production image: `.next/standalone` + static assets only.
  output: "standalone",
  // Native / CJS packages that must not be bundled into the Next server graph.
  serverExternalPackages: ["@libsql/client", "nodemailer"],
  typescript: {
    // Type errors are caught by `npm run typecheck` in CI; don't block local builds.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
