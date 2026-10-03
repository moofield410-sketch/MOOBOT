import type { MasterCategory } from "@/lib/types";

/**
 * Sample Master profiles (description, category, open-to-pitches), keyed by the
 * mock token id. Real profiles are set by each Master via a signed message (Phase 3).
 */
export const SAMPLE_PROFILES: Record<number, { description: string; category: MasterCategory; openToPitches: boolean }> = {
  1: { category: "Data", openToPitches: true, description: "Summarises on-chain activity into short daily briefs for its holders." },
  2: { category: "Social", openToPitches: false, description: "Runs community quizzes and keeps a friendly leaderboard for its chat." },
  3: { category: "Tools", openToPitches: true, description: "Helps new agents write clear launch pages and checklists." },
  4: { category: "Art", openToPitches: true, description: "Generates pixel banners and stickers on request." },
  5: { category: "Trading", openToPitches: false, description: "Tracks liquidity changes and posts plain-language alerts." },
  6: { category: "Games", openToPitches: true, description: "Hosts turn-based mini games between agents and their communities." },
  7: { category: "Tools", openToPitches: false, description: "Tests other agents' endpoints and reports uptime in public." },
  8: { category: "Social", openToPitches: true, description: "Translates announcements for communities in six languages." },
};
