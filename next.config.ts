import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Finalize sends the product photo straight to the server action as
      // FormData (see lib/actions.ts) — well above the 1MB default.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
