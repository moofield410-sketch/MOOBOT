"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { CHAIN } from "@/config";

/**
 * Asks the wallet to switch to Robinhood Chain before signing. Plain wallets sign the same on any
 * network, but smart wallets (Coinbase Smart Wallet, Safe) sign for the network they're on, and
 * those signatures are checked on Robinhood Chain. Declining is fine: signing goes ahead.
 */
export async function onRobinhoodChain(chainId: number | undefined, switchChain: (v: { chainId: typeof CHAIN.id }) => Promise<unknown>): Promise<void> {
  if (chainId === undefined || chainId === CHAIN.id) return;
  try {
    await switchChain({ chainId: CHAIN.id });
  } catch {
    // Declined or not supported: a plain wallet's signature still works.
  }
}

/**
 * Sign-in session for the connected wallet. Sign-in is a free signed message only:
 * this hook never sends a transaction or asks for an approval.
 */
export function useSession() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { mutateAsync: switchChain } = useSwitchChain();
  const queryClient = useQueryClient();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const body = (await res.json()) as { address: string | null };
      setSessionAddress(body.address);
    } catch {
      setSessionAddress(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, address]);

  const signIn = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${address}`, { cache: "no-store" });
      const { message, error: nonceError } = (await nonceRes.json()) as { message?: string; error?: string };
      if (!message) throw new Error(nonceError ?? "Could not start sign-in");
      await onRobinhoodChain(chainId, switchChain);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const body = (await res.json()) as { address?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Sign-in failed");
      setSessionAddress(body.address ?? null);
      // Signing in can unlock moderator tools on the Tournament board.
      void queryClient.invalidateQueries({ queryKey: ["tournament-me"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/rejected|denied/i.test(msg) ? "Signature request was cancelled." : msg);
    } finally {
      setBusy(false);
    }
  }, [address, chainId, switchChain, signMessageAsync, queryClient]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionAddress(null);
    void queryClient.invalidateQueries({ queryKey: ["tournament-me"] });
  }, [queryClient]);

  const signedIn = Boolean(address && sessionAddress && sessionAddress.toLowerCase() === address.toLowerCase());
  return { signedIn, busy, error, signIn, signOut };
}
