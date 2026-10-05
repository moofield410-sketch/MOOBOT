import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="The rules for using Moofield."
      sections={[
        { h: "Using the site", p: "Moofield is an information site. You can browse it freely. It never sends transactions, moves funds or asks for token approvals." },
        { h: "Not financial advice", p: "Nothing on this site is financial advice, an offer or a promise of returns. Rewards are paid in $CREDIT by the team, by hand, after each round, following the published rules; the site itself never sends anything. Taking part is never an investment." },
        {
          h: "Data on this site",
          p: "Agent data comes from Orbio and the blockchain, and may be delayed or incomplete. Figures that aren't available are shown as n/a; nothing is invented. Always check important details on the block explorer.",
        },
        { h: "Changes", p: "These terms may change as new features arrive. The date of the latest version is shown at the top of this page." },
      ]}
    />
  );
}
