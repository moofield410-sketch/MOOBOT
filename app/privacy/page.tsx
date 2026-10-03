import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="What Moofield knows about you, which is very little."
      sections={[
        { h: "No account needed", p: "You can browse without signing up or connecting a wallet." },
        {
          h: "Wallet data",
          p: "When you connect a wallet, the site reads public balances for your address. Signing in checks a free signed message and is not stored; once voting is built, votes will be stored as signed messages. Signatures cannot move funds.",
        },
        {
          h: "Your browser",
          p: "The site stores a few small things in your browser: preferences such as MooBot's position, your wallet connection, and, if you sign in, a session cookie that keeps you signed in for up to a day.",
        },
        { h: "Questions", p: "Contact details will be listed here before launch." },
      ]}
    />
  );
}
