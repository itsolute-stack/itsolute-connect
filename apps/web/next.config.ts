import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
