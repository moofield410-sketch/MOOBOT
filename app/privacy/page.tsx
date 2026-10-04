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
        {
          h: "Chatting with MooBot",
          p: "When MooBot's chat is on and you ask him something, your question and the last few messages of the conversation are sent to Orbio's AI gateway to write the answer. Moofield doesn't save the conversation: it stays in your browser tab until you close it. To count the daily question limit, the site keeps a one-way code made from your IP address for that day only. It can't be turned back into your IP. Don't type personal details, and never share a seed phrase.",
        },
        { h: "Questions", p: "Contact details will be listed here before launch." },
      ]}
    />
  );
}
