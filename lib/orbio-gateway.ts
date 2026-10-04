import { GATEWAY } from "@/config";

/**
 * Orbio's paid gateway (models and tools), billed to the owner's Orbio balance. SERVER-SIDE ONLY:
 * it reads ORBIO_API_KEY, which must never reach the browser or a log line.
 * Docs: https://www.orbio.so/launchpad/docs.md ("Model inference", "Call a tool").
 */

export type GatewayFetch = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

const defaultFetch: GatewayFetch = (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(GATEWAY.timeoutMs) });

/** A refused gateway call. `status` is Orbio's HTTP status (401 key, 402 balance, 429 busy, ...). */
export class GatewayError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

const FRIENDLY: Record<number, string> = {
  400: "Orbio refused the request (arguments or cost cap)",
  401: "The Orbio key is missing, invalid or was rotated",
  402: "The Orbio balance is too low",
  404: "Orbio doesn't know that tool",
  409: "The social account isn't connected in the Orbio dashboard",
  429: "Orbio is busy (rate limit)",
  502: "Orbio's provider failed",
};

export function gatewayKey(): string | null {
  const k = process.env[GATEWAY.keyEnv]?.trim();
  return k ? k : null;
}

async function post(path: string, body: unknown, f: GatewayFetch): Promise<{ status: number; body: unknown }> {
  const key = gatewayKey();
  if (!key) throw new GatewayError(401, FRIENDLY[401]);
  const res = await f(`${GATEWAY.baseUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new GatewayError(res.status, FRIENDLY[res.status] ?? `Orbio returned ${res.status}`);
  return { status: res.status, body: json };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** One chat completion (OpenAI shape) through Orbio's model gateway. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { model: string; maxTokens: number; temperature: number },
  f: GatewayFetch = defaultFetch,
): Promise<ChatResult> {
  const { body } = await post("/chat/completions", { model: opts.model, messages, max_tokens: opts.maxTokens, temperature: opts.temperature }, f);
  const b = obj(body);
  const choice = obj(Array.isArray(b?.choices) ? b.choices[0] : null);
  const text = obj(choice?.message)?.content;
  if (typeof text !== "string") throw new GatewayError(502, "Orbio returned no answer");
  const usage = obj(b?.usage);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { text, inputTokens: n(usage?.prompt_tokens), outputTokens: n(usage?.completion_tokens) };
}

export type ToolResult =
  | { status: "settled"; result: unknown; costCredit: string | null }
  /** Orbio accepted it and is still working. Never resubmit this one (Orbio's docs). */
  | { status: "running"; id: string | null };

/** Calls one Orbio tool (POST /tools/{name}). `args.max_cost` bounds what it may spend. */
export async function callTool(name: string, args: Record<string, unknown>, f: GatewayFetch = defaultFetch): Promise<ToolResult> {
  const { status, body } = await post(`/tools/${encodeURIComponent(name)}`, args, f);
  const b = obj(body);
  if (status === 202) return { status: "running", id: typeof b?.id === "string" ? b.id : null };
  const credit = obj(b?.cost)?.credit;
  return { status: "settled", result: b?.result ?? null, costCredit: typeof credit === "string" ? credit : null };
}
