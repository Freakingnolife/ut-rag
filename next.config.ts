import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/chat": ["./data/index.bin", "./data/index.meta.json"],
  },
};

export default nextConfig;
