import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Card";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";
import { USE_MOCK_DATA } from "@/config";

export const metadata: Metadata = { title: "My Wallet" };

export default function WalletPage() {
  return (
    <div>
      <PageHeader
        eyebrow="My Wallet"
        title="Your wallet"
        intro="Balances are only read, never moved. Signing in is a free message that costs no gas."
      />
      <WalletDashboard preview={USE_MOCK_DATA} />
    </div>
  );
}
