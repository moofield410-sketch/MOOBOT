import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // lib/docs.server.ts reads content/docs/*.md from disk. The Docs pages are prerendered at build,
  // but if one ever renders on request (e.g. on Netlify's server function) the files must be there.
  outputFileTracingIncludes: {
    "/docs/*": ["./content/docs/**/*.md"],
  },
};

export default nextConfig;
