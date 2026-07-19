import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  // Monorepo: trace from the repo root so the Prisma query engine (in the root
  // pnpm store) is bundled into the Vercel serverless functions.
  outputFileTracingRoot: repoRoot,
  // Our workspace packages ship TS source — transpile them.
  transpilePackages: ["@itsolute/db", "@itsolute/auth"],
  // Keep Prisma + bcrypt out of the bundle (Node-only, loaded at runtime).
  serverExternalPackages: ["@prisma/client", ".prisma/client", "bcryptjs"],
  eslint: { ignoreDuringBuilds: true },
  // Our workspace packages import with NodeNext-style ".js" specifiers that map
  // to ".ts" source — let webpack resolve those.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
