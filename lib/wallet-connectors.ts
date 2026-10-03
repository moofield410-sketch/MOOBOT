/**
 * How connect options are listed. Wallets installed in the browser announce themselves
 * (EIP-6963), and wagmi turns each into its own connector with the wallet's id (its reverse
 * domain, e.g. "io.metamask"), name and icon. The generic injected() connector (id "injected")
 * is whatever wallet owns window.ethereum, so it is only offered when no wallet announced itself.
 */

export interface ConnectorLike {
  id: string;
  type: string;
  name: string;
  icon?: string;
}

/** The identity flags wallets set on window.ethereum. Read in the browser and passed in, so this file stays pure. */
export interface InjectedFlags {
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isOkxWallet?: boolean;
  isPhantom?: boolean;
  isRainbow?: boolean;
  isZerion?: boolean;
  isMetaMask?: boolean;
}

export const WALLET_ICON_DIR = "/wallet-icons";
export const GENERIC_WALLET_ICON = `${WALLET_ICON_DIR}/generic-wallet.svg`;
export const WALLETCONNECT_ICON = `${WALLET_ICON_DIR}/walletconnect.svg`;

export interface KnownWallet {
  /** EIP-6963 reverse-domain id. */
  id: string;
  name: string;
  /** Local copy of the wallet's official icon (public/wallet-icons). */
  icon: string;
  /** The wallet's official download page. */
  installUrl: string;
  /** window.ethereum flag(s) that identify it. */
  flags: (keyof InjectedFlags)[];
}

const known = (id: string, name: string, file: string, installUrl: string, flags: (keyof InjectedFlags)[]): KnownWallet => ({
  id,
  name,
  icon: `${WALLET_ICON_DIR}/${file}.svg`,
  installUrl,
  flags,
});

/** Popular wallets, in the order they are offered under "More wallets". */
export const KNOWN_WALLETS: readonly KnownWallet[] = [
  known("io.metamask", "MetaMask", "metamask", "https://metamask.io/download/", ["isMetaMask"]),
  known("com.coinbase.wallet", "Coinbase Wallet", "coinbase", "https://www.coinbase.com/wallet/downloads", ["isCoinbaseWallet"]),
  known("io.rabby", "Rabby Wallet", "rabby", "https://rabby.io/", ["isRabby"]),
  known("com.trustwallet.app", "Trust Wallet", "trust", "https://trustwallet.com/download", ["isTrust", "isTrustWallet"]),
  known("com.okex.wallet", "OKX Wallet", "okx", "https://www.okx.com/web3", ["isOkxWallet"]),
  known("app.phantom", "Phantom", "phantom", "https://phantom.com/download", ["isPhantom"]),
  known("com.brave.wallet", "Brave Wallet", "brave", "https://brave.com/wallet/", ["isBraveWallet"]),
  known("me.rainbow", "Rainbow", "rainbow", "https://rainbow.me/download", ["isRainbow"]),
  known("io.zerion.wallet", "Zerion", "zerion", "https://zerion.io/download", ["isZerion"]),
];

const byId = new Map(KNOWN_WALLETS.map((w) => [w.id, w]));

/**
 * Which wallet owns window.ethereum. Many wallets also set isMetaMask for compatibility, so the
 * specific flags are checked first and isMetaMask last.
 */
const FLAG_ORDER: [keyof InjectedFlags, string][] = [
  ["isRabby", "io.rabby"],
  ["isBraveWallet", "com.brave.wallet"],
  ["isCoinbaseWallet", "com.coinbase.wallet"],
  ["isTrust", "com.trustwallet.app"],
  ["isTrustWallet", "com.trustwallet.app"],
  ["isOkxWallet", "com.okex.wallet"],
  ["isPhantom", "app.phantom"],
  ["isRainbow", "me.rainbow"],
  ["isZerion", "io.zerion.wallet"],
  ["isMetaMask", "io.metamask"],
];

/** Every flag detectInjected reads, for copying them off window.ethereum. */
export const INJECTED_FLAG_KEYS: readonly (keyof InjectedFlags)[] = FLAG_ORDER.map(([flag]) => flag);

export function detectInjected(flags: InjectedFlags | null | undefined): KnownWallet | null {
  if (!flags) return null;
  const hit = FLAG_ORDER.find(([flag]) => flags[flag] === true);
  return hit ? byId.get(hit[1])! : null;
}

export const isGenericInjected = (c: ConnectorLike) => c.type === "injected" && c.id === "injected";

export function connectorLabel(c: ConnectorLike): string {
  if (isGenericInjected(c)) return "Browser wallet";
  if (c.type === "walletConnect") return "WalletConnect";
  return c.name;
}

/** connectorLabel, but names the generic browser wallet from window.ethereum's flags when it can. */
export function walletLabel(c: ConnectorLike, flags?: InjectedFlags | null): string {
  if (isGenericInjected(c)) return detectInjected(flags)?.name ?? "Browser wallet";
  return connectorLabel(c);
}

/** Named browser wallets first (in the order they were found), then WalletConnect. */
export function connectOptions<C extends ConnectorLike>(connectors: readonly C[]): { named: C[]; shown: C[] } {
  const named = connectors.filter((c) => c.type === "injected" && !isGenericInjected(c));
  const shown = connectors.filter((c) => !(isGenericInjected(c) && named.length > 0));
  return { named, shown: [...shown].sort((a, b) => Number(a.type === "walletConnect") - Number(b.type === "walletConnect")) };
}

/** The icon comes from the wallet itself; only inline images (data: URIs) are shown. */
export function safeIcon(icon: string | undefined): string | null {
  return icon && /^data:image\/(svg\+xml|png|jpeg|webp|gif)[;,]/.test(icon) ? icon : null;
}

/**
 * The icon for a connect button, in order: the wallet's own EIP-6963 icon, the local icon for a
 * known wallet id, WalletConnect's icon, the wallet identified from window.ethereum's flags, then
 * the generic wallet icon. Always returns something, so no button has an empty icon box.
 */
export function walletIcon(c: ConnectorLike, flags?: InjectedFlags | null): string {
  const own = safeIcon(c.icon);
  if (own) return own;
  const knownWallet = byId.get(c.id);
  if (knownWallet) return knownWallet.icon;
  if (c.type === "walletConnect") return WALLETCONNECT_ICON;
  if (isGenericInjected(c)) return detectInjected(flags)?.icon ?? GENERIC_WALLET_ICON;
  return GENERIC_WALLET_ICON;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+wallet$/, "").trim();

/**
 * Popular wallets that weren't found in the browser, for "More wallets". A wallet counts as found
 * if it announced itself (by id or name) or owns window.ethereum (by its flags), so it is never
 * listed twice.
 */
export function moreWallets(connectors: readonly ConnectorLike[], flags?: InjectedFlags | null): KnownWallet[] {
  const named = connectors.filter((c) => c.type === "injected" && !isGenericInjected(c));
  const ids = new Set(named.map((c) => c.id));
  const names = new Set(named.map((c) => norm(c.name)));
  // window.ethereum's owner is installed even if it didn't announce itself, so never call it "Not installed".
  const owner = detectInjected(flags);
  return KNOWN_WALLETS.filter((w) => !ids.has(w.id) && !names.has(norm(w.name)) && w.id !== owner?.id);
}
