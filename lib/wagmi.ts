import { robinhood } from "viem/chains";
import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
// Import WalletConnect directly: the "wagmi/connectors" barrel pulls in every SDK (Coinbase, Base, Safe…).
import { walletConnect } from "@wagmi/connectors/walletConnect";

/**
 * Wallet connection (Phase 2). Used only to connect and to sign the free sign-in message.
 * Balances are read on the server, so the browser transport is the chain's public RPC and is
 * never given RPC_URL. WalletConnect is enabled only when its project ID is set.
 */
export function getWagmiConfig() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const url = typeof window !== "undefined" ? window.location.origin : "https://localhost";
  return createConfig({
    chains: [robinhood],
    connectors: [
      injected(),
      ...(projectId
        ? [
            walletConnect({
              projectId,
              showQrModal: true,
              // Absolute PNG: phone wallets show it next to the site name, and many ignore SVG.
              metadata: { name: "Moofield", description: "Moofield: The Tournament", url, icons: [`${url}/moobot-assets/moobot-token.png`] },
            }),
          ]
        : []),
    ],
    transports: { [robinhood.id]: http() },
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}

export const walletConnectEnabled = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
