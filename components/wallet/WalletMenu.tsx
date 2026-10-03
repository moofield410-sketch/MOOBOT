"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { MooBotMascot } from "@/components/MooBotMascot";
import { useSession } from "@/components/wallet/useSession";
import { AUTH } from "@/config";
import { shortAddress } from "@/lib/format";
import {
  connectOptions,
  GENERIC_WALLET_ICON,
  INJECTED_FLAG_KEYS,
  isGenericInjected,
  moreWallets,
  walletIcon,
  walletLabel,
  type InjectedFlags,
} from "@/lib/wallet-connectors";

/** Copies the identity flags off window.ethereum. null when no wallet injected one. */
function readInjectedFlags(): InjectedFlags | null {
  const eth = (window as unknown as { ethereum?: Record<string, unknown> }).ethereum;
  if (!eth || typeof eth !== "object") return null;
  return Object.fromEntries(INJECTED_FLAG_KEYS.filter((k) => eth[k] === true).map((k) => [k, true]));
}

/** A 24px wallet icon on a small tile, so dark logos stay visible on the dark theme. */
function WalletIconTile({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soil/5 ring-1 ring-soil/10">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local SVG or the wallet's own data: URI; nothing to optimise */}
      <img src={failed ? GENERIC_WALLET_ICON : src} alt="" width={24} height={24} className="h-6 w-6 rounded-md" onError={() => setFailed(true)} />
    </span>
  );
}

const MORE_COLLAPSED = 4;

/**
 * Connect options, in order: wallets found in this browser (each with its own name and icon),
 * WalletConnect when it is set up, then popular wallets that aren't installed, with an Install link.
 * See lib/wallet-connectors.ts.
 */
export function ConnectOptions({ onDone }: { onDone?: () => void }) {
  const { connectors, connect, isPending, variables, error } = useConnect();
  // undefined until mounted (window.ethereum can only be read in the browser), then null if there is none.
  const [flags, setFlags] = useState<InjectedFlags | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setFlags(readInjectedFlags()), []);

  const { named, shown } = connectOptions(connectors);
  // With no window.ethereum at all, the generic "Browser wallet" button could only fail, so it's dropped.
  const browser = shown.filter((c) => c.type !== "walletConnect" && !(isGenericInjected(c) && flags === null));
  const walletConnect = shown.filter((c) => c.type === "walletConnect");
  const more = moreWallets(connectors, flags);
  const moreShown = showAll ? more : more.slice(0, MORE_COLLAPSED);
  const pendingUid = isPending && variables && "uid" in variables.connector ? variables.connector.uid : null;

  const button = (c: (typeof shown)[number]) => (
    <button
      key={c.uid}
      type="button"
      disabled={isPending}
      onClick={() => connect({ connector: c }, { onSuccess: () => onDone?.() })}
      className="btn-secondary w-full justify-start gap-2.5 py-2 pl-2"
    >
      {/* Keyed by src: the icon can change once window.ethereum's flags are read after mount. */}
      <WalletIconTile key={walletIcon(c, flags)} src={walletIcon(c, flags)} />
      <span className="truncate">{walletLabel(c, flags)}</span>
      {pendingUid === c.uid && <span className="ml-auto shrink-0 text-xs text-soil/70">Check your wallet…</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {(named.length > 0 || flags) && <p className="text-xs text-soil/70">Wallets found in your browser:</p>}
        {browser.map(button)}
        {browser.length === 0 && <p className="text-xs text-soil/70">No wallet found in this browser.</p>}
      </div>

      {walletConnect.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-soil/70">Scan with a phone wallet:</p>
          {walletConnect.map(button)}
        </div>
      )}

      {more.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-soil/70">More wallets:</p>
          <ul>
            {moreShown.map((w) => (
              <li key={w.id} className="flex items-center gap-2.5 py-1.5">
                <WalletIconTile src={w.icon} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-soil">{w.name}</p>
                  <p className="text-[11px] text-soil/60">Not installed</p>
                </div>
                <a href={w.installUrl} target="_blank" rel="noopener noreferrer" className="tap link shrink-0 text-xs" aria-label={`Install ${w.name} (opens in a new tab)`}>
                  Install
                </a>
              </li>
            ))}
          </ul>
          {more.length > MORE_COLLAPSED && (
            <button type="button" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll} className="tap mt-1 text-xs text-soil/75 hover:text-grass">
              {showAll ? "Show less" : `Show all (${more.length})`}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-moss">
          {/provider not found|no provider/i.test(error.message) ? "No browser wallet found." : error.message.split("\n")[0]}
        </p>
      )}
      <p className="text-xs text-soil/65">Connecting only reads your address. Nothing is sent from your wallet.</p>
    </div>
  );
}

export function WalletMenu({ block = false }: { block?: boolean }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signedIn, busy, error, signIn, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Success moment: when a wallet connects in this visit, MooBot cheers for 1.5s with a gold burst.
  const wasConnected = useRef<boolean | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    if (wasConnected.current === false && isConnected) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1500);
      wasConnected.current = isConnected;
      return () => clearTimeout(t);
    }
    wasConnected.current = isConnected;
  }, [isConnected, mounted]);

  const label = mounted && isConnected && address ? shortAddress(address) : "Connect wallet";

  return (
    <div ref={ref} className={`relative ${block ? "w-full" : ""}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`btn-secondary ${block ? "w-full" : ""} ${mounted && isConnected ? "font-mono" : ""} ${celebrate ? "!overflow-visible" : ""}`}
      >
        {celebrate && (
          <span aria-hidden className="relative -my-2 -ml-2 flex items-center">
            <MooBotMascot variant="head" state="happy" size={26} decorative />
            <span className="burst">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} style={{ "--a": `${i * 30}deg`, animationDelay: `${(i % 3) * 40}ms` } as React.CSSProperties} />
              ))}
            </span>
          </span>
        )}
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Wallet"
          className={`card absolute z-50 mt-2 max-h-[min(80vh,40rem)] w-72 overflow-y-auto bg-milk p-4 shadow-2xl shadow-soil/20 ${block ? "left-0" : "right-0"}`}
        >
          {!isConnected ? (
            <>
              <p className="mb-3 text-sm font-semibold text-soil">Connect a wallet</p>
              <ConnectOptions onDone={() => setOpen(false)} />
            </>
          ) : (
            <div className="space-y-3">
              <p className="break-all font-mono text-xs text-soil/85">{address}</p>
              <Link href="/wallet" onClick={() => setOpen(false)} className="btn-secondary w-full">
                My Wallet
              </Link>
              {signedIn ? (
                <button type="button" onClick={signOut} className="btn-secondary w-full">
                  Signed in · Sign out
                </button>
              ) : (
                <>
                  <button type="button" onClick={signIn} disabled={busy} className="btn-primary w-full">
                    {busy ? "Check your wallet…" : "Sign in"}
                  </button>
                  <p className="text-xs text-soil/70">You&apos;ll sign a free message. {AUTH.safetyLine}</p>
                </>
              )}
              {error && (
                <p role="alert" className="text-xs text-moss">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  signOut();
                  disconnect();
                  setOpen(false);
                }}
                className="w-full text-center text-sm text-soil/75 hover:text-grass"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
