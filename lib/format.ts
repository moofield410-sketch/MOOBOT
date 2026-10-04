import { CHAIN } from "@/config";

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function formatUsd(n: number | null): string {
  if (n === null) return "n/a";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Orbio's micro-USD strings (6 decimals). Prices under a dollar keep 3 significant digits
 * ($0.0000190), larger amounts round to whole dollars ($19,845).
 */
export function formatMicroUsd(micro: string | null): string {
  if (micro === null) return "n/a";
  const usd = Number(micro) / 1e6;
  if (usd !== 0 && Math.abs(usd) < 1) return `$${usd.toLocaleString("en-US", { maximumSignificantDigits: 3, minimumSignificantDigits: 3 })}`;
  return formatUsd(usd);
}

export function formatInt(n: number | string | bigint | null): string {
  if (n === null) return "n/a";
  return typeof n === "string" ? BigInt(n).toLocaleString("en-US") : n.toLocaleString("en-US");
}

/** 1,284 / 12.9K / 4.2M */
export function formatCompact(n: number | string | null): string {
  if (n === null) return "n/a";
  const v = typeof n === "string" ? Number(n) : n;
  if (Math.abs(v) < 10_000) return Math.round(v).toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

/** Decimals a chart tick needs to tell it from its neighbours (a step of 0.00002 needs 5). */
export function stepDecimals(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

/** Server-rendered dates use UTC so markup is identical everywhere. */
export function formatUtc(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** "3 Oct 2026" (always UTC). */
export function formatDate(at: string | number): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "3 Oct 2026, 14:00 UTC". Every time on the site is shown in UTC, never the visitor's zone. */
export function formatUtcDateTime(at: string | number): string {
  const d = new Date(at);
  return `${formatDate(d.getTime())}, ${d.toISOString().slice(11, 16)} UTC`;
}

/** Countdown as "HH:MM:SS"; hours keep counting past 24 ("31:04:09"). */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** "Updated 3 Oct 2026, 04:53 UTC" */
export function formatUpdated(iso: string | null): string {
  if (!iso) return "Not updated yet";
  return `Updated ${formatUtcDateTime(iso)}`;
}

/** Explorer links only when an explorer is configured and the data is real. */
export function explorerLink(kind: "tx" | "address" | "token", value: string, isMock: boolean): string | null {
  if (isMock || !CHAIN.explorerUrl) return null;
  return `${CHAIN.explorerUrl.replace(/\/$/, "")}/${kind}/${value}`;
}
