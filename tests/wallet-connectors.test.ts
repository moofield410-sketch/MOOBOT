import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import {
  connectOptions,
  connectorLabel,
  detectInjected,
  GENERIC_WALLET_ICON,
  KNOWN_WALLETS,
  moreWallets,
  safeIcon,
  WALLETCONNECT_ICON,
  walletIcon,
  walletLabel,
  type ConnectorLike,
} from "@/lib/wallet-connectors";

const ICON = "data:image/svg+xml;base64,PHN2Zy8+";
const generic: ConnectorLike = { id: "injected", type: "injected", name: "Injected" };
const metamask: ConnectorLike = { id: "io.metamask", type: "injected", name: "MetaMask", icon: ICON };
const rabby: ConnectorLike = { id: "io.rabby", type: "injected", name: "Rabby Wallet", icon: ICON };
const phantom: ConnectorLike = { id: "app.phantom", type: "injected", name: "Phantom", icon: ICON };
const wc: ConnectorLike = { id: "walletConnect", type: "walletConnect", name: "WalletConnect" };

describe("wallet connect options", () => {
  it("lists every wallet found in the browser by its own name", () => {
    const { named, shown } = connectOptions([generic, wc, metamask, rabby, phantom]);
    assert.deepEqual(named.map(connectorLabel), ["MetaMask", "Rabby Wallet", "Phantom"]);
    assert.deepEqual(shown.map(connectorLabel), ["MetaMask", "Rabby Wallet", "Phantom", "WalletConnect"]);
  });

  it("never shows several identical 'Browser wallet' buttons", () => {
    const labels = connectOptions([generic, metamask, rabby, phantom]).shown.map(connectorLabel);
    assert.equal(new Set(labels).size, labels.length);
    assert.ok(!labels.includes("Browser wallet"));
  });

  it("falls back to one 'Browser wallet' button when no wallet announces itself", () => {
    assert.deepEqual(connectOptions([generic, wc]).shown.map(connectorLabel), ["Browser wallet", "WalletConnect"]);
  });

  it("shows only inline image icons supplied by the wallet", () => {
    assert.equal(safeIcon(ICON), ICON);
    assert.equal(safeIcon("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
    assert.equal(safeIcon("https://evil.example/track.png"), null);
    assert.equal(safeIcon("javascript:alert(1)"), null);
    assert.equal(safeIcon("data:text/html,<script>"), null);
    assert.equal(safeIcon(undefined), null);
  });
});

describe("walletIcon", () => {
  it("a. uses the wallet's own EIP-6963 icon", () => {
    assert.equal(walletIcon(metamask), ICON);
    assert.equal(walletIcon({ id: "xyz.unknown", type: "injected", name: "Unknown", icon: ICON }), ICON);
  });

  it("b. falls back to the local icon for a known wallet id", () => {
    const ids = ["io.metamask", "com.coinbase.wallet", "io.rabby", "com.trustwallet.app", "com.okex.wallet", "app.phantom", "com.brave.wallet", "me.rainbow", "io.zerion.wallet"];
    for (const id of ids) {
      const icon = walletIcon({ id, type: "injected", name: id });
      assert.match(icon, /^\/wallet-icons\/[a-z]+\.svg$/, id);
      assert.notEqual(icon, GENERIC_WALLET_ICON, id);
    }
    assert.equal(walletIcon({ ...rabby, icon: undefined }), "/wallet-icons/rabby.svg");
  });

  it("c. uses the WalletConnect icon", () => {
    assert.equal(walletIcon(wc), WALLETCONNECT_ICON);
  });

  it("d. names the generic browser wallet from window.ethereum's flags", () => {
    assert.equal(walletIcon(generic, { isMetaMask: true }), "/wallet-icons/metamask.svg");
    assert.equal(walletLabel(generic, { isMetaMask: true }), "MetaMask");
    assert.equal(walletIcon(generic, { isCoinbaseWallet: true }), "/wallet-icons/coinbase.svg");
    assert.equal(walletLabel(generic, { isTrustWallet: true }), "Trust Wallet");
    assert.equal(walletLabel(generic, { isOkxWallet: true }), "OKX Wallet");
  });

  it("e. otherwise shows the generic wallet icon", () => {
    assert.equal(walletIcon(generic), GENERIC_WALLET_ICON);
    assert.equal(walletIcon(generic, null), GENERIC_WALLET_ICON);
    assert.equal(walletIcon(generic, {}), GENERIC_WALLET_ICON);
    assert.equal(walletLabel(generic, {}), "Browser wallet");
    assert.equal(walletIcon({ id: "xyz.unknown", type: "injected", name: "Unknown" }), GENERIC_WALLET_ICON);
  });

  it("rejects unsafe icons supplied by a wallet and falls back to a local one", () => {
    for (const bad of ["https://evil.example/track.png", "javascript:alert(1)", "data:text/html,<script>", "/relative.svg"]) {
      assert.equal(walletIcon({ ...metamask, icon: bad }), "/wallet-icons/metamask.svg");
      assert.equal(walletIcon({ id: "xyz.unknown", type: "injected", name: "Unknown", icon: bad }), GENERIC_WALLET_ICON);
    }
  });

  it("every local icon exists in public/", () => {
    for (const src of [GENERIC_WALLET_ICON, WALLETCONNECT_ICON, ...KNOWN_WALLETS.map((w) => w.icon)]) {
      assert.ok(existsSync(`public${src}`), src);
    }
  });
});

describe("window.ethereum flag detection", () => {
  it("checks specific wallets before isMetaMask, which many wallets also set", () => {
    assert.equal(detectInjected({ isRabby: true, isMetaMask: true })?.name, "Rabby Wallet");
    assert.equal(detectInjected({ isBraveWallet: true, isMetaMask: true })?.name, "Brave Wallet");
    assert.equal(detectInjected({ isCoinbaseWallet: true, isMetaMask: true })?.name, "Coinbase Wallet");
    assert.equal(detectInjected({ isTrust: true, isMetaMask: true })?.name, "Trust Wallet");
    assert.equal(detectInjected({ isOkxWallet: true, isMetaMask: true })?.name, "OKX Wallet");
    assert.equal(detectInjected({ isPhantom: true, isMetaMask: true })?.name, "Phantom");
    assert.equal(detectInjected({ isMetaMask: true })?.name, "MetaMask");
    assert.equal(walletIcon(generic, { isRabby: true, isMetaMask: true }), "/wallet-icons/rabby.svg");
  });

  it("follows the documented order when several specific flags are set", () => {
    assert.equal(detectInjected({ isRabby: true, isBraveWallet: true })?.name, "Rabby Wallet");
    assert.equal(detectInjected({ isBraveWallet: true, isCoinbaseWallet: true })?.name, "Brave Wallet");
    assert.equal(detectInjected({ isCoinbaseWallet: true, isTrust: true })?.name, "Coinbase Wallet");
    assert.equal(detectInjected({ isTrust: true, isOkxWallet: true })?.name, "Trust Wallet");
    assert.equal(detectInjected({ isOkxWallet: true, isPhantom: true })?.name, "OKX Wallet");
  });

  it("finds nothing without flags", () => {
    assert.equal(detectInjected(null), null);
    assert.equal(detectInjected(undefined), null);
    assert.equal(detectInjected({}), null);
  });
});

describe("More wallets", () => {
  const ids = (list: { id: string }[]) => list.map((w) => w.id);

  it("lists every popular wallet when none is installed", () => {
    assert.deepEqual(ids(moreWallets([generic, wc])), ids([...KNOWN_WALLETS]));
  });

  it("never lists a wallet that announced itself", () => {
    const more = ids(moreWallets([generic, wc, metamask, rabby, phantom]));
    for (const id of ["io.metamask", "io.rabby", "app.phantom"]) assert.ok(!more.includes(id), id);
    assert.equal(more.length, KNOWN_WALLETS.length - 3);
  });

  it("matches by name too, in case a wallet announces under another id", () => {
    const more = ids(moreWallets([{ id: "com.example.trust", type: "injected", name: "Trust Wallet", icon: ICON }]));
    assert.ok(!more.includes("com.trustwallet.app"));
  });

  it("never lists the wallet that owns window.ethereum", () => {
    assert.ok(!ids(moreWallets([generic], { isRabby: true, isMetaMask: true })).includes("io.rabby"));
    assert.ok(ids(moreWallets([generic], { isRabby: true, isMetaMask: true })).includes("io.metamask"));
  });

  it("links each to its official https download page", () => {
    for (const w of KNOWN_WALLETS) assert.match(w.installUrl, /^https:\/\//, w.name);
  });
});
