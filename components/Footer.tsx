import Link from "next/link";
import { DISCLAIMER, SITE, SOCIAL } from "@/config";
import { MooBotMascot } from "@/components/MooBotMascot";
import { OfficialMooBotCard } from "@/components/moobot/OfficialMooBotCard";
import { DiscordIcon, TelegramIcon, XIcon } from "@/components/ui/Icons";

const EXPLORE = [
  { href: "/masters", label: "Masters" },
  { href: "/tournament", label: "Tournament" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/credits", label: "Credits" },
  { href: "/wallet", label: "My Wallet" },
];

const PROJECT = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/roadmap", label: "Roadmap" },
  { href: "/status", label: "Status" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

const COMMUNITY = [
  { key: "x", label: SOCIAL.x ? `X ${SOCIAL.xHandle}` : "X", url: SOCIAL.x, Icon: XIcon },
  { key: "telegram", label: "Telegram", url: SOCIAL.telegram, Icon: TelegramIcon },
  { key: "discord", label: "Discord", url: SOCIAL.discord, Icon: DiscordIcon },
] as const;

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-soil">{title}</p>
      <ul className="space-y-0 pointer-fine:space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="tap text-sm text-fern no-underline transition-colors hover:text-moss">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-28 overflow-hidden bg-milk/40">
      <div aria-hidden className="signal-divider" />
      <div className="safe-x relative mx-auto grid max-w-7xl gap-10 py-14 sm:[--safe-pad:1.5rem] md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2.5">
            <MooBotMascot variant="head" size={28} decorative />
            <span className="font-display text-lg font-semibold tracking-tight text-soil">Moofield</span>
          </span>
          <p className="mt-4 max-w-xs text-sm text-fern">{SITE.tagline}</p>
          <p className="mt-4 text-sm font-medium text-soil">Browse freely: no wallet signing needed.</p>
          <div className="mt-6 max-w-xs border-t border-line pt-4">
            <OfficialMooBotCard compact />
          </div>
        </div>

        <FooterLinks title="Explore" links={EXPLORE} />
        <FooterLinks title="Project" links={PROJECT} />

        <div>
          <p className="mb-3 text-sm font-semibold text-soil">Community</p>
          <ul className="space-y-0 pointer-fine:space-y-2">
            {COMMUNITY.map(({ key, label, url, Icon }) => (
              <li key={key}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-2 text-sm text-fern no-underline transition-colors hover:text-moss">
                    <Icon /> {label}
                  </a>
                ) : (
                  <span className="tap inline-flex items-center gap-2 text-sm text-soil/60" title="Coming soon">
                    <Icon /> {label}
                    <span className="text-xs text-soil/60">· Coming soon</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-line">
        <div className="safe-x mx-auto flex max-w-7xl flex-col gap-2 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-xs sm:[--safe-pad:1.5rem] leading-relaxed text-fern sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-1">
            <p className="font-semibold text-soil/85">{DISCLAIMER}</p>
            <p>Nothing here is an offer or a promise of returns. Tournament rewards are paid in $CREDIT by the team after each round; the site itself never sends anything. MooBot is an original character.</p>
          </div>
          <p className="flex shrink-0 items-end gap-2">
            {/* A small sleeping MooBot in the corner. */}
            <span aria-hidden className="opacity-80">
              <MooBotMascot state="sleeping" size={44} decorative />
            </span>
            © 2026 {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
