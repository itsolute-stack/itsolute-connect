import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  // Monorepo: trace from the repo root so the Prisma query engine (in the root
  // pnpm store) is bundled into the Vercel serverless functions.
  outputFileTracingRoot: repoRoot,
  // Force the Prisma query engine binary into EVERY function bundle. The plugin
  // alone got it into route handlers but not page/server-action functions, so
  // page renders + the login action still failed to load the engine.
  outputFileTracingIncludes: {
    // "/**" matches routes with a segment (/admin, /calls…) but NOT the bare
    // root "/" — which is the owner dashboard. Include "/" explicitly.
    "/": ["../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node"],
    "/**": ["../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node"],
  },
  // Our workspace packages ship TS source — transpile them.
  transpilePackages: ["@itsolute/db", "@itsolute/auth"],
  // Keep Prisma + bcrypt out of the bundle (Node-only, loaded at runtime).
  serverExternalPackages: ["@prisma/client", ".prisma/client", "bcryptjs"],
  eslint: { ignoreDuringBuilds: true },
  // Our workspace packages import with NodeNext-style ".js" specifiers that map
  // to ".ts" source — let webpack resolve those.
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    // Copy the Prisma query engine next to the server bundle (monorepo + Next
    // otherwise doesn't trace the .so.node → "Query Engine not found" at runtime).
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
