import type { NextConfig } from "next";

/**
 * Netlify's edge (CDN) cache for the public pages. Every visitor gets the same HTML (no page reads
 * cookies; wallets and sign-in are client-side), so the edge may answer from its copy and refresh
 * it in the background (stale-while-revalidate), instead of every visit waiting for the server.
 * Only Netlify's edge reads Netlify-CDN-Cache-Control: browsers still revalidate every time.
 * The site's own in-page refreshes (router.refresh after a vote, the RoundWatcher at a round
 * change) are React Server Component requests: they carry an `rsc` header, are left out here and
 * always reach the server, so nobody's own action is hidden behind a cached copy.
 */
const edge = (maxAge: number, swr: number) => `public, durable, max-age=${maxAge}, stale-while-revalidate=${swr}`;
const notRsc = [
  { type: "header" as const, key: "rsc" },
  { type: "header" as const, key: "next-router-prefetch" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // lib/docs.server.ts reads content/docs/*.md from disk. The Docs pages are prerendered at build,
  // but if one ever renders on request (e.g. on Netlify's server function) the files must be there.
  outputFileTracingIncludes: {
    "/docs/*": ["./content/docs/**/*.md"],
  },
  async headers() {
    return [
      // Pages: a minute at the edge, then served stale while it refreshes. Not the API, Next's own
      // files (already cached for good), the Status page (diagnostics must be live) or the game's
      // share images.
      {
        source: "/((?!api/|_next/|status|play/).*)",
        missing: notRsc,
        headers: [{ key: "Netlify-CDN-Cache-Control", value: edge(60, 600) }],
      },
      // The Tournament board and the leaderboard move with every vote: a few seconds only.
      // (Listed last, so it wins over the rule above for these paths.)
      {
        source: "/:page(tournament|leaderboard)/:rest*",
        missing: notRsc,
        headers: [{ key: "Netlify-CDN-Cache-Control", value: edge(5, 60) }],
      },
      {
        source: "/:page(tournament|leaderboard)",
        missing: notRsc,
        headers: [{ key: "Netlify-CDN-Cache-Control", value: edge(5, 60) }],
      },
    ];
  },
};

export default nextConfig;
