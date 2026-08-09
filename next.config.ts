import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  experimental: {
    optimizePackageImports: ["recharts", "cytoscape"],
  },
};

export default nextConfig;
