import { KvConflictError } from "@/lib/kv";
import { errorMessage, reportError } from "@/lib/monitoring";
import { TournamentError } from "@/lib/tournament/rules";

const NO_STORE = { "Cache-Control": "no-store" };

/** Runs a Tournament request: refusals become a plain message with their status; anything else is logged. */
export async function respond(where: string, run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run(), { headers: NO_STORE });
  } catch (err) {
    if (err instanceof TournamentError) return Response.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    if (err instanceof KvConflictError) return Response.json({ error: "Lots of people are acting at once. Please try again." }, { status: 503, headers: NO_STORE });
    reportError(err, { route: where });
    return Response.json({ error: `Something went wrong: ${errorMessage(err)}` }, { status: 502, headers: NO_STORE });
  }
}

/** The JSON body of a signed action: { message, signature }. */
export async function signedBody(req: Request): Promise<{ message: unknown; signature: unknown }> {
  try {
    const body = (await req.json()) as { message?: unknown; signature?: unknown };
    return { message: body?.message, signature: body?.signature };
  } catch {
    return { message: undefined, signature: undefined };
  }
}
