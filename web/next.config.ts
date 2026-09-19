import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const apiOrigin =
  process.env.METACENTER_API_ORIGIN ?? "https://metacenter-indexer-production.up.railway.app";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  // The browser only ever talks to this site's domain; /api/* is proxied to the indexer.
  // App routes (e.g. /api/search for the docs) take precedence over this rewrite.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default createMDX()(nextConfig);
