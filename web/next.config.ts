import type { NextConfig } from "next";

const apiOrigin =
  process.env.METACENTER_API_ORIGIN ?? "https://metacenter-indexer-production.up.railway.app";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  // The browser only ever talks to this site's domain; /api/* is proxied to the indexer.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
