import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray parent-level package-lock.json otherwise confuses root inference.
  // Pin the workspace root to this project so builds resolve deterministically.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
