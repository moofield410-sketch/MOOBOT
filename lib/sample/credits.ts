import type { CreditMarket, DailyCredits } from "@/lib/types";

/** Sample Orbio $CREDIT received by the MooBot agent. Invented; shown only while USE_MOCK_DATA is on. */

const END_DAY = Date.parse("2026-10-02T00:00:00Z");
const DAY_MS = 86_400_000;

/** 30 days of deterministic, gently rising daily $CREDIT received (whole $CREDIT). */
export const SAMPLE_DAILY_CREDITS: DailyCredits[] = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(END_DAY - (29 - i) * DAY_MS).toISOString().slice(0, 10);
  const trend = 260 + i * 9;
  const wave = Math.round(Math.sin(i * 0.9) * 45 + Math.cos(i * 0.37) * 30);
  return { day, credits: trend + wave };
});

export const SAMPLE_TOTAL_CREDITS = SAMPLE_DAILY_CREDITS.reduce((sum, d) => sum + d.credits, 0);

export const SAMPLE_CREDIT_MARKET: CreditMarket = {
  history: SAMPLE_DAILY_CREDITS,
  received24h: SAMPLE_DAILY_CREDITS[SAMPLE_DAILY_CREDITS.length - 1].credits,
  movements: [
    { at: "2026-10-02T15:10:00Z", kind: "$CREDIT received", amount: 118 },
    { at: "2026-10-02T11:42:00Z", kind: "Agent operations", amount: -64 },
    { at: "2026-10-02T08:03:00Z", kind: "$CREDIT received", amount: 203 },
    { at: "2026-10-01T19:30:00Z", kind: "$CREDIT received", amount: 176 },
    { at: "2026-10-01T12:58:00Z", kind: "Agent operations", amount: -71 },
  ],
};
