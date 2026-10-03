import { VOTING } from "@/config";

/**
 * Voting power from a snapshot balance (whole $ORBIO), using the configured model.
 * Below the minimum balance there is no voting power.
 */
export function votingPower(balance: number, holdsMooBot = false): number {
  if (balance < VOTING.minOrbio) return 0;
  const base = VOTING.powerModel === "sqrt" ? Math.floor(Math.sqrt(balance)) : Math.min(balance, VOTING.powerCap);
  return holdsMooBot ? base * VOTING.moobotHolderBonus : base;
}
