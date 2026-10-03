import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, "Cache-Control": "no-store" } },
  );
}
