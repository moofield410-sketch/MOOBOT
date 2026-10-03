/**
 * Why a figure shows "n/a". One place for the wording, so every page says the same thing.
 * Kept out of the "use client" NotAvailable module: server components can't read plain values
 * exported from a client module (they get a client reference instead of the strings).
 */
export const NA_REASONS = {
  orbioMissing: "Orbio doesn't publish this yet.",
  /** Orbio returned null for this field ("null means unavailable, never zero"). */
  orbioNull: "Orbio has no value for this yet.",
  moobotAgent: "Appears once the official $MOOBOT contract is confirmed on Orbio.",
  capNotSet: "The per-round cap isn't set yet.",
  moobotUnverified: "The $MOOBOT contract couldn't be confirmed on Orbio yet.",
  rpcMissing: "Balance source not connected yet.",
} as const;

/** Shown for every $MOOBOT item until the contract is verified. Never a number. */
export const MOOBOT_NOT_LAUNCHED = "Not launched yet";
