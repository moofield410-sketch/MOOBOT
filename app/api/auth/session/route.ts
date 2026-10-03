import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = sessionSecret();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const address = secret ? verifySessionToken(token, secret) : null;
  return Response.json({ address, configured: secret !== null }, { headers: { "Cache-Control": "no-store" } });
}
