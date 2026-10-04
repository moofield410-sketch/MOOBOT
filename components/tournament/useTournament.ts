"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useSchedule } from "@/components/ScheduleProvider";
import { CHAIN } from "@/config";
import type { RoundState } from "@/lib/rounds";
import { buildAction, type ActionFields, type ActionKind } from "@/lib/tournament/messages";
import type { LedgerEntry } from "@/lib/tournament/results";
import type { Address } from "@/lib/types";

/** What /api/tournament/me returns for the connected wallet. */
export interface TournamentMe {
  address: Address;
  round: RoundState;
  isModerator: boolean;
  power: { balance: number; power: number; block: string; method: "direct" | "transfers" } | null;
  powerError: string | null;
  vote: { pitchId: string; power: number; castAt: string } | null;
  agents: { agentId: string; name: string; ticker: string | null; token: Address; pitchId: string | null; pitchHidden: boolean }[] | null;
  agentsError: string | null;
  masters: { token: Address; name: string; agentId: string | null; scored: string[] }[];
  mastersError: string | null;
  ledger: LedgerEntry[];
}

export const ME_KEY = "tournament-me";

/** The connected wallet's Tournament state, or null with no wallet. Shared by every card on the page. */
export function useTournamentMe() {
  const { address } = useAccount();
  const query = useQuery({
    queryKey: [ME_KEY, address?.toLowerCase()],
    queryFn: async (): Promise<TournamentMe> => {
      const res = await fetch(`/api/tournament/me?address=${address}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },
    enabled: Boolean(address),
    staleTime: 15_000,
  });
  return { address: address?.toLowerCase() as Address | undefined, ...query };
}

/**
 * Signs and sends one Tournament action. The message is built here, shown by the wallet, and
 * checked by the server word for word. Signing is free: no gas, no transaction, no approval.
 */
export function useSignedAction<K extends ActionKind>(kind: K) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { now, timeline } = useSchedule();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = useCallback(
    async (round: number, fields: ActionFields<K>): Promise<boolean> => {
      if (!address) return false;
      setBusy(true);
      setError(null);
      try {
        // The server clock, so a wrong device clock can't make the signature look expired.
        const issuedAt = new Date(timeline ? now : Date.now()).toISOString();
        const message = buildAction({ kind, address: address.toLowerCase() as Address, chainId: CHAIN.id, round, fields, issuedAt });
        const signature = await signMessageAsync({ message });
        const res = await fetch(`/api/tournament/${kind}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status}). Please try again.`);
        setDone(true);
        await queryClient.invalidateQueries({ queryKey: [ME_KEY] });
        router.refresh();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(/rejected|denied|cancel/i.test(msg) ? "Signature request was cancelled." : msg.split("\n")[0]);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [address, kind, now, timeline, signMessageAsync, queryClient, router],
  );

  return { send, busy, error, done, reset: () => (setDone(false), setError(null)) };
}
