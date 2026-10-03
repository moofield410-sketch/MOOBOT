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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
