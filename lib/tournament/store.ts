import { kvCas, kvGet, kvSet, kvSetIf } from "@/lib/kv";
import { emptyRound, type FinalRound, type PowerRecord, type RoundDoc, type TendersDoc } from "@/lib/tournament/types";
import type { Address } from "@/lib/types";

/**
 * Where the Tournament lives: one KV document per round, one for all tenders, and one small record
 * per wallet's voting power. Netlify Blobs on Netlify (kept for good), memory elsewhere.
 * Writes go through kvCas, so two people acting at the same moment can never break a rule.
 */

export const roundKey = (n: number) => `t:round:${n}`;
export const TENDERS_KEY = "t:tenders";
export const powerKey = (n: number, wallet: Address) => `t:power:${n}:${wallet.toLowerCase()}`;

export async function readRound(n: number): Promise<RoundDoc> {
  return (await kvGet<RoundDoc>(roundKey(n))) ?? emptyRound(n);
}

export async function readTenders(): Promise<TendersDoc> {
  return (await kvGet<TendersDoc>(TENDERS_KEY)) ?? { tenders: [] };
}

/** Tries before a busy moment answers "try again": everyone in a round writes the same document. */
const ROUND_TRIES = 16;

/** Changes a round safely: `change` sees the latest document and returns the new one (or throws to refuse). */
export function updateRound<R>(n: number, change: (doc: RoundDoc) => { doc: RoundDoc; result: R }): Promise<R> {
  return kvCas<RoundDoc, R>(
    roundKey(n),
    (current) => {
      const { doc, result } = change(current ?? emptyRound(n));
      return { value: doc, result };
    },
    ROUND_TRIES,
  );
}

export function updateTenders<R>(change: (doc: TendersDoc) => { doc: TendersDoc; result: R }): Promise<R> {
  return kvCas<TendersDoc, R>(
    TENDERS_KEY,
    (current) => {
      const { doc, result } = change(current ?? { tenders: [] });
      return { value: doc, result };
    },
    ROUND_TRIES,
  );
}

export const readPower = (n: number, wallet: Address) => kvGet<PowerRecord>(powerKey(n, wallet));
export const writePower = (p: PowerRecord) => kvSet(powerKey(p.round, p.wallet), p);

/** A finished round's frozen result (written once, never changed). */
export const finalKey = (n: number) => `t:final:${n}`;
export const readFinal = (n: number) => kvGet<FinalRound>(finalKey(n));

/** Stores a round's frozen result if none exists yet; returns whichever is stored (the first writer wins). */
export async function freezeFinal(f: FinalRound): Promise<FinalRound> {
  if (await kvSetIf(finalKey(f.round), f, null)) return f;
  return (await readFinal(f.round)) ?? f;
}
