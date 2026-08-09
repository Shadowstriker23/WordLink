import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    optimizePackageImports: ["recharts", "cytoscape"],
  },
};

export default nextConfig;
