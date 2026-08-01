import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits on top of the guest camera UI and pollutes UI screenshots.
  devIndicators: false,
  // archiver is CommonJS with `module.exports = fn`. Bundling it breaks the callable
  // export; leaving it external lets Node's own CJS interop handle it correctly.
  serverExternalPackages: ["archiver"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/**"],
  },
};

export default nextConfig;
