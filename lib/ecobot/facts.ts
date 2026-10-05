import { REWARDS, SITE } from "@/config";
import { readSpend } from "@/lib/ecobot/store";
import { utcDay } from "@/lib/field-fund-history";
import { formatUsd } from "@/lib/format";
import { liveFacts } from "@/lib/moobot-chat";
import { getMooBot } from "@/lib/moobot";
import { formatCredits, receivedFrom } from "@/lib/rewards";

/**
 * The live facts the persona jobs see (lib/ecobot/persona.ts): the chat's facts (schedule, the
 * official address, Masters, agents, the live round) plus MooBot's own figures from Orbio and what
 * it spent today. Anything that can't be read is left out, never guessed.
 */
export async function botFacts(now: number): Promise<string[]> {
  const facts = await liveFacts().catch(() => [] as string[]);
  const m = await getMooBot().catch(() => null);
  if (m?.status === "verified") {
    const a = m.agent;
    const mcap = a.marketCapMicroUsd ? Number(a.marketCapMicroUsd) / 1e6 : null;
    if (mcap !== null) facts.push(`${SITE.ticker} market cap on Orbio: ${formatUsd(mcap)}.`);
    if (a.graduated) facts.push(`${SITE.ticker} has graduated (it's a Master).`);
    else if (a.curveProgressBps != null) facts.push(`${SITE.ticker} is still on its bonding curve: ${(a.curveProgressBps / 100).toFixed(1)}% of the way to graduation.`);
    const received = receivedFrom(a);
    if (received !== null) facts.push(`CREDIT received by the ${SITE.ticker} agent so far (the Field Fund): ${formatCredits(received)}.`);
  }
  facts.push(
    `Tournament rewards: each round's pool is ${REWARDS.roundPoolPctOfTreasury}% of the treasury (the rest rolls over), and the dev tops it up so every round's pool is at least ${REWARDS.roundPoolFloorCredits} CREDIT (a share nobody qualifies for, like an empty Masters' share, rolls over). The whole pool goes to the top ${REWARDS.pitchPlaces.length} pitches, the voters and the Masters who took part. The team pays the winners by hand after each round; the result is frozen when the round ends. A round needs at least ${REWARDS.minVoters} voters to pay out.`,
  );
  const spend = await readSpend(utcDay(now)).catch(() => null);
  if (spend) {
    const total = spend.modelUsd + spend.researchCredit + spend.postCredit;
    facts.push(`What you spent today on thinking, research and posting (paid in CREDIT): about $${total.toFixed(2)}, over ${spend.editorRuns + spend.replyRuns + spend.composeRuns + spend.studyRuns} runs.`);
  }
  return facts;
}
