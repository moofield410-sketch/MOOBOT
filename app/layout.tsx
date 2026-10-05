import type { Metadata, Viewport } from "next";
import { Fredoka, JetBrains_Mono, Nunito } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MooBotGuide } from "@/components/MooBotGuide";
import { LaunchAnnouncement } from "@/components/moobot/LaunchAnnouncement";
import { PointerEffects } from "@/components/motion/PointerEffects";
import { PREVIEW_BANNER_SCRIPT, PreviewBanner } from "@/components/PreviewBanner";
import { Providers } from "@/components/Providers";
import { RoundWatcher } from "@/components/RoundWatcher";
import { ScheduleProvider } from "@/components/ScheduleProvider";
import { SITE, USE_MOCK_DATA } from "@/config";
import { REVEAL_SCRIPT } from "@/lib/motion-scripts";
import "./globals.css";

const fredoka = Fredoka({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

// Netlify sets URL (the site's main address) on every build, so the OG image resolves to an absolute URL.
const siteUrl = URL.canParse(process.env.URL ?? "") ? new URL(process.env.URL!) : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: `${SITE.event}: new AI agents will pitch features to graduated Orbio agents, and the community will vote. ${SITE.tagline}`,
  icons: { icon: "/moobot-assets/moobot-token.svg" },
};

export const viewport: Viewport = {
  themeColor: "#DCEDF5",
  // Lets the page use the full screen on notched phones; safe-x and the safe-area paddings keep content clear.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
        {USE_MOCK_DATA && <script dangerouslySetInnerHTML={{ __html: PREVIEW_BANNER_SCRIPT }} />}
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-grass focus:px-4 focus:py-2 focus:font-semibold focus:text-on-grass"
        >
          Skip to content
        </a>
        <Providers>
          <ScheduleProvider>
            {USE_MOCK_DATA && <PreviewBanner />}
            <Header />
            <LaunchAnnouncement />
            <main id="main" className="safe-x mx-auto w-full max-w-7xl flex-1 pt-10 sm:pt-14 sm:[--safe-pad:1.5rem]">
              {children}
            </main>
            <Footer />
            <MooBotGuide />
            <PointerEffects />
            <RoundWatcher />
          </ScheduleProvider>
        </Providers>
      </body>
    </html>
  );
}
