/**
 * Error monitoring hook. Logs to the console for now; wire Sentry (or similar)
 * here later without touching callers.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  // Log the stack as text: passing the Error object makes Next's dev overlay build a code frame,
  // which crashes under the WASM compiler this machine uses.
  const stack = error instanceof Error && error.stack ? `\n${error.stack}` : "";
  console.error(`[moobot] ${message} ${JSON.stringify(context)}${stack}`);
}

/** Server secrets that must never appear in anything a visitor can see. */
const SECRET_ENVS = ["RPC_URL", "ORBIO_API_KEY", "CRON_SECRET", "SESSION_SECRET", "NETLIFY_BLOBS_TOKEN"];

/**
 * An error as one short line that is safe to show anyone. Libraries put details in later lines
 * (viem adds "URL: <rpc url>" and the request body, and a provider's API key often sits in that
 * URL's path), so only the first line is kept, every URL is cut to its origin (the RPC's to
 * "[rpc]"), and any secret value from the environment is masked. The full error still goes to the
 * server log through reportError.
 */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let t = raw.split("\n")[0].trim();
  const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  let rpcOrigin: string | null = null;
  try {
    rpcOrigin = env.RPC_URL ? new URL(env.RPC_URL).origin : null;
  } catch {
    rpcOrigin = null;
  }
  for (const k of SECRET_ENVS) {
    const v = env[k]?.trim();
    if (v && v.length >= 8) t = t.split(v).join("[hidden]");
  }
  t = t.replace(/https?:\/\/[^\s"'<>)]+/g, (u) => {
    try {
      const o = new URL(u).origin;
      return o === rpcOrigin ? "[rpc]" : o;
    } catch {
      return "[link]";
    }
  });
  t = t.replace(/\b(sk-[A-Za-z0-9_-]{10,}|nfp_[A-Za-z0-9]{10,})/g, "[hidden]");
  return t.slice(0, 300);
}
