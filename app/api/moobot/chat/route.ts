import { askMooBot, chatUsage } from "@/lib/moobot-chat";

export const dynamic = "force-dynamic";

/** The visitor's IP, only to count the daily limit (hashed in lib/moobot-chat.ts, never stored). Netlify sets the first header. */
function clientIp(req: Request): string {
  return req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the chat is on, and how many questions this visitor has left today. */
export async function GET(req: Request) {
  return Response.json(await chatUsage(clientIp(req)), { headers: NO_STORE });
}

/** One question to MooBot: {messages: [{role, content}]} with the last few turns. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const r = await askMooBot(body, clientIp(req));
  const status = r.ok ? 200 : r.reason === "off" ? 404 : r.reason === "invalid" ? 400 : r.reason === "error" ? 502 : 429;
  return Response.json(r, { status, headers: NO_STORE });
}
