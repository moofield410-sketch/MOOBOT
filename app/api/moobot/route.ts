import { getMooBot } from "@/lib/moobot";

export const dynamic = "force-dynamic";

/**
 * The $MOOBOT launch switch, for the browser: "not-launched" until MOOBOT_TOKEN_ADDRESS is set,
 * valid and confirmed on the Orbio API; then "verified" with the contract address and the
 * MooBot agent's public figures. The browser never calls Orbio itself.
 */
export async function GET() {
  return Response.json(await getMooBot(), { headers: { "Cache-Control": "no-store" } });
}
