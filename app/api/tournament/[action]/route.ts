import { refreshTournamentState } from "@/lib/tournament";
import { respond, signedBody } from "@/lib/tournament/http";
import { castVote, defaultDeps, postTender, submitPitch, submitScore } from "@/lib/tournament/service";

export const dynamic = "force-dynamic";
// Reading voting power can take a few chain reads the first time a wallet votes.
export const maxDuration = 30;

const ACTIONS = { pitch: submitPitch, vote: castVote, score: submitScore, tender: postTender } as const;

/**
 * POST /api/tournament/{pitch|vote|score|tender} with { message, signature }: a free signed
 * message, never a transaction. The message says exactly what the wallet agreed to.
 */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const run = ACTIONS[action as keyof typeof ACTIONS];
  if (!run) return Response.json({ error: "Unknown action" }, { status: 404 });
  const { message, signature } = await signedBody(req);
  return respond(`tournament/${action}`, async () => {
    const saved = await run(defaultDeps, message, signature);
    refreshTournamentState();
    const { message: _m, signature: _s, ...shown } = saved;
    return { ok: true, [action]: shown };
  });
}
