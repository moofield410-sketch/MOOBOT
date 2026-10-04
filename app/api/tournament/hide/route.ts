import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth/session";
import { refreshTournamentState } from "@/lib/tournament";
import { respond } from "@/lib/tournament/http";
import { defaultDeps, hidePitch } from "@/lib/tournament/service";

export const dynamic = "force-dynamic";

/** Moderators only: hides a pitch (signed-in session whose wallet is in MODERATOR_WALLETS). */
export async function POST(req: Request) {
  const secret = sessionSecret();
  const by = secret ? verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret) : null;
  let body: { pitchId?: unknown; reason?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is refused below.
  }
  return respond("tournament/hide", async () => {
    const r = await hidePitch(defaultDeps, by, body.pitchId, body.reason);
    refreshTournamentState();
    return { ok: true, ...r };
  });
}
