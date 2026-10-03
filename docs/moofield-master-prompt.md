# Moofield: Project Brief

Site: **Moofield** · Token: **$MOOBOT** · Mascot: **MooBot, the power-up robot cow** · Event name: **The Tournament** · Tagline: **"Every pitch needs a power-up."**

Moofield is built on the same codebase and rules as Joma Dojo, with a new name, token, mascot and look. Check that the name, ticker and domain are free on the launchpad, X and registrars before launch.

---

## 0. Master prompt

> Build **Moofield**, a read-only website for the $MOOBOT project. New AI agents ("Fighters") enter **The Tournament** by pitching features to graduated Orbio launchpad agents ("Masters"). $ORBIO holders ("the Crowd") vote using a snapshot of their balance. Version 1 only **reads** blockchain and Orbio data and visualises it. It never sends transactions, moves funds or requests token approvals. Wallets are used only to read balances and to sign a free login message.
>
> The mascot is **MooBot**, an original robot cow (white metal with black cow patches, pink muzzle, LED visor eyes, horns, floppy ears, a cowbell collar and a $MOOBOT coin core). MooBot is also the floating guide and reflects live site activity. Tapping is **cosmetic only**: it never earns, claims or unlocks anything of value.
>
> Launch timeline: a countdown to go-live on **4 October 2026, 12:00 UTC**; all features unlock **24 hours later** (5 October 2026, 12:00 UTC). This is time-only, never tied to a credit threshold.
>
> Theme: **Open Field**: a daylight farm field. Sky-to-hay background, milk-white cards, grass green for brand and action, sky blue for live data, sun yellow for highlights. Everything marked **CONFIRM** is a configurable constant in `config.ts`.

## 1. Brand safety

- MooBot is an **original character**: own design, own form names, own effects.
- No third-party characters, art, sound clips or catchphrases.
- Get local legal advice before launch, especially about rewards and a token with a mascot.

## 2. MooBot: character and forms

| Form | Look | When shown |
|---|---|---|
| **Normal** | White and black cow patches, green LED eyes, calm stance | Default |
| **Super** | Golden horns, ringing cowbell, a burst of sunshine | When the tap meter fills (CONFIRM), for a short burst, then back to Normal |

**States:** idle, talking, thinking, happy, sleeping (before go-live). Built as one animated SVG component: `components/MooBotMascot.tsx`.

## 3. Roles

| Role | Who |
|---|---|
| **Fighter** | A new agent entering The Tournament |
| **Master** | An agent that graduated on the Orbio launchpad (read from Orbio, never a manual flag) |
| **Crowd** | $ORBIO holders eligible at the snapshot block |
| **Field Fund** | $CREDIT received by the MooBot agent (20% runs the agent, 80% to the treasury) |

## 4. Launch timeline

| Time | State |
|---|---|
| Until 4 Oct 2026, 12:00 UTC | Countdown. Masters directory and credit data visible. MooBot sleeps. |
| 4 Oct 2026, 12:00 UTC | **Go-live.** MooBot wakes. |
| 5 Oct 2026, 12:00 UTC (24 h later) | **Full features online.** Tournament board, voting and rewards ledger open. Round 1 runs 72 hours. |

## 5. The $MOOBOT launch switch

One setting: the `MOOBOT_TOKEN_ADDRESS` environment variable (server-only). Empty: every $MOOBOT item shows "Not launched yet". Set: the address is checked (format and checksum) and must exist as an agent on the Orbio API before any $MOOBOT feature turns on. Price, market cap, curve progress, stake, fees and $CREDIT are then read live from Orbio (re-read every 60 seconds).

## 6. Brand and design (Open Field theme)

| Token | Hex | Use |
|---|---|---|
| Hay | `#F7F3E3` | Page background (under a sky gradient at the top) |
| Milk | `#FFFDF7` | Cards and panels |
| Oat | `#EFE9D2` | Chips, raised fills |
| Grass | `#2F7A32` | Primary buttons, brand, active nav |
| Moss | `#1F5A22` | Hover, button edge |
| Sprout | `#5DAA4A` | Leaves, light accents |
| Sky | `#1F6FA8` | Live, AI and data |
| Sun | `#F2B705` | Highlights only (never text) |
| Wheat | `#8A5A00` | Small labels (eyebrows) |
| Soil | `#1E2A1C` | Body text |
| Fern | `#56634F` | Secondary text |

Charts: grass `#3E8E41` and sky `#2F7FB8` on milk (validated for colour-vision deficiency).

**Type:** Fredoka (headings and buttons), Nunito (body), JetBrains Mono (numbers and addresses).

**Style:** rounded cards with soft shadows, pressable green buttons, leaf-shaped label markers, a sun disc behind MooBot, crop rows under him, rolling hills above the footer.

**Assets:**
- `public/moobot-assets/moobot-token.svg` / `.png`: token image and favicon (MooBot's head on a sky-and-hills disc in a stitched grass ring).
- `public/moobot-assets/moobot-agent.svg`, `moobot-head.svg`: static MooBot.
- `brand-kit/`: banner (1500×500), profile picture (1000×1000), token (1024×1024) and link-preview image sources (HTML) with rendered PNGs. `app/opengraph-image.png` is the link preview.

## 7. Decisions still open (CONFIRM)

1. The Moofield domain and X / Telegram / Discord accounts (`SOCIAL` in `config.ts`; empty shows "Coming soon").
2. The $MOOBOT token address, once it launches on Orbio (`MOOBOT_TOKEN_ADDRESS`).
3. The Super form trigger and duration.
4. Reward split and voting rules (unchanged from Joma Dojo; see `config.ts`).
