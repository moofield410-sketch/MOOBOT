import { AUTH } from "@/config";
import { createSessionToken, SESSION_COOKIE, sessionSecret } from "@/lib/auth/session";
import { verifySignIn } from "@/lib/auth/verify";
import { errorMessage, reportError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/** Verifies a signed sign-in message and sets an httpOnly session cookie. */
export async function POST(req: Request) {
  const secret = sessionSecret();
  if (!secret) return Response.json({ error: "Sign-in is not configured yet" }, { status: 503 });

  let body: { message?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof body.message !== "string" || typeof body.signature !== "string" || body.message.length > 1_000) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await verifySignIn(body.message, body.signature);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 401 });

    const token = createSessionToken(result.address, secret);
    const cookie = [
      `${SESSION_COOKIE}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.floor(AUTH.sessionTtlMs / 1000)}`,
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
    return Response.json({ address: result.address }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch (err) {
    reportError(err, { route: "auth/verify" });
    return Response.json({ error: `Could not verify the signature: ${errorMessage(err)}` }, { status: 502 });
  }
}
