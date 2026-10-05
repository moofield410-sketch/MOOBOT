import { readRound, readTenders } from "@/lib/tournament/store";

export const dynamic = "force-dynamic";

/**
 * The public audit log of one round: every pitch, vote and score with the exact message its
 * wallet signed and the signature, the moderation log, and the tenders posted that round.
 * Anyone can re-check a signature with any Ethereum library (personal_sign / EIP-191).
 */
export async function GET(req: Request) {
  const round = Number(new URL(req.url).searchParams.get("round") ?? "1");
  if (!Number.isInteger(round) || round < 1 || round > 100_000) return Response.json({ error: "Invalid round" }, { status: 400 });
  const [doc, tenders] = await Promise.all([readRound(round), readTenders()]);
  // A hidden pitch's text was removed for a reason (spam, a scam link), so it isn't republished here.
  const hiddenIds = new Set(doc.hidden.map((h) => h.pitchId));
  const pitches = doc.pitches.map((p) => (hiddenIds.has(p.id) ? { id: p.id, round: p.round, agentId: p.agentId, submittedBy: p.submittedBy, submittedAt: p.submittedAt, hidden: true } : p));
  return Response.json(
    {
      round,
      snapshot: doc.snapshot,
      pitches,
      votes: doc.votes,
      scores: doc.scores,
      hidden: doc.hidden.map((h) => ({ ...h, removedVotes: h.removedVotes.length })),
      tenders: tenders.tenders.filter((t) => t.round === round),
      howToCheck:
        "Each message was signed with personal_sign (EIP-191). For a normal wallet, recover the signer from message + signature and compare it with the address in the message. A smart-contract wallet (Coinbase Smart Wallet, Safe) can't be recovered that way: check it on Robinhood Chain (chain 4663) with ERC-1271 / ERC-6492, e.g. viem's publicClient.verifyMessage({ address, message, signature }).",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
