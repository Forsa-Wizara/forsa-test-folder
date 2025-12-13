import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Active le hook instrumentation.ts pour warm-up au démarrage
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
