"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, DataEnvelope, WalletBalances } from "@/lib/types";

/** Balances for a connected wallet, read on the server (/api/wallet). Shared by My Wallet and MooBot. */
export function useWalletBalances(address: Address | undefined) {
  return useQuery({
    queryKey: ["wallet", address],
    queryFn: async (): Promise<DataEnvelope<WalletBalances>> => {
      const res = await fetch(`/api/wallet/${address}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<DataEnvelope<WalletBalances>>;
    },
    enabled: Boolean(address),
  });
}
