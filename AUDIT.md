# Wording audit

> Carried over from the Joma Dojo build (same code, renamed to Moofield on 4 October 2026). Rows about the X account no longer apply: Moofield has no confirmed X, Telegram or Discord account yet, so the footer shows all three as "Coming soon" and the Privacy page says contact details will be listed before launch.

Audit of every factual claim the site makes about what it does or offers, checked against the code on **3 October 2026**. It covers:
- every page and component;
- the API response labels;
- every file in `content/docs`, including text added in stages 1 and 2 of this job.

**Status key**
- **LIVE**: built and working now.
- **LOCKED**: built, unlocks at go-live + 24h, which is 4 Oct 2026, 15:30 UTC (`AGENT_LIVE_AT` + `FULL_UNLOCK_AFTER_H`).
- **PLANNED**: not built.
- **INACCURATE**: the old wording didn't match the code. The Fix column says what changed.

The Fix column gives the final wording or the action taken. Every INACCURATE row is fixed in the code. Docs now carry a visible tag on each feature (Live / Opens 4 October 2026, 15:30 UTC / Planned), and all their numbers come from `config.ts` (see section 6).

## 1. Specific checks requested

| Check | Finding in code | Result and fix |
|---|---|---|
| **"Agent goes live": is an agent running?** | No. `AGENT_LIVE_AT` is only a clock (`lib/schedule.ts`). Orbio has no MooBot agent: `MOOBOT_TOKEN_ADDRESS` is empty, and a search for `q=moobot` found nothing. | **INACCURATE.** Renamed **"go-live"** everywhere (Docs, MooBot, launch timeline, schedule label, Credits). The Docs say: "Go-live is the site's schedule. It does not mean an agent is running." The MooBot agent's real status comes from the `$MOOBOT` launch switch ("Not launched yet" until verified). A test and the smoke test forbid "agent goes live". |
| **Rewards: displayed, not paid** | Nothing pays anything. `lib/rewards.ts` only computes and has never been run on a real round, and there are no write calls (the read-only check passes). | **LIVE as a statement.** It appears on Rewards, Credits, FAQ, footer, Terms and Safety, and the rewards test requires "displayed, not paid". The ledger is described as empty until rounds are scored (**PLANNED**). |
| **Vote minimum** | `VOTING.minOrbio = 1_000`, configurable. | Now worded "the voting minimum (currently 1,000 $ORBIO, configurable)" on the Docs, home FAQ and glossary. The Docs value comes from `{{MIN_ORBIO}}`. |
| **20/80 split** | A display calculation in `lib/rewards.ts` (`splitReceived`). No contract enforces it. | Reworded as **"Moofield's policy … not enforced on-chain"**. The treasury is described as "an accounting figure the site displays, not a separate on-chain account". |
| **Orbio's fee split** | It's in Orbio's live terms (`GET /api/protocol/agents/terms`: `feeBps`, `conversionBps`, `creditBps`, `gatewayBps`), and Orbio can change it. | Not hard-coded anywhere. Rewards (Docs) and the Credits "MooBot agent on Orbio" card link to [Orbio's docs](https://www.orbio.so/launchpad/docs) and the [live terms](https://www.orbio.so/api/protocol/agents/terms), stored in `ORBIO_LINKS`. |
| **"Refreshes every few minutes": is a scheduled job configured on Netlify?** | **No.** There is no `netlify.toml` and no scheduled function. `/api/cron/scan` exists, but nothing calls it. Masters refresh **on demand**: a visit after `CACHE.mastersTtlMs` (3 min) triggers a fetch. | The only "every few minutes" text was a code comment in `app/api/cron/scan/route.ts`; it now says no scheduler is configured. User-facing text now reads "refreshed when someone visits (at most every 3 minutes)" (from config). |
| **Definition of "graduated"** | `lib/sources/orbio-api.ts`: an agent's `price.graduated === true` in Orbio's list, **and** `curve.graduated === true` on its own `/agents/{id}` record. If they disagree, it's hidden and logged. | The glossary and Masters page now say exactly this (field names in the glossary). Covered by a test. |
| **8h / 24h** | There is no 8-hour step any more; only `FULL_UNLOCK_AFTER_H = 24` exists. | No "8 hours" text remains. The 24h figure comes from `{{UNLOCK_AFTER_H}}`. |

## 2. Docs (`content/docs`)

| File | Quote (before) | Status | Fix |
|---|---|---|---|
| getting-started.md | "a friendly competition where new AI agents pitch … The community votes, and the best pitches of each round share the rewards." | INACCURATE (describes unbuilt features in the present tense) | "a **planned** competition where new AI agents pitch … and the community votes". A tag legend was added. |
| getting-started.md | "Masters … receive pitches, can post requests called tenders, and share the Masters bucket" | INACCURATE (pitches, tenders and scores aren't built) | "listed today; receiving and scoring pitches is planned". |
| getting-started.md | "Everything is counted from the moment the MooBot agent goes live" | INACCURATE | "counted from **go-live**". Added: "Go-live is the site's schedule. It does not mean an agent is running." |
| getting-started.md | "the Tournament opens: pitching, voting and the rewards ledger" (at +24h) | INACCURATE (only the board unlocks; submission isn't built) | "the Tournament board opens and the Round 1 clock starts. Pitch and vote submission are still being built." |
| getting-started.md | "Follow the Credits page to see how the treasury grows" | INACCURATE (no figures until $MOOBOT is verified) | "Its figures appear once the official $MOOBOT contract is confirmed on Orbio; until then they show n/a." |
| getting-started.md | "Masters come from Orbio's agent data" | LIVE | Kept, plus the refresh behaviour. |
| pitching.md | "Fighters answer with a bid pitch", "A Fighter can also post an idea" | PLANNED | Future tense, with [[Planned]] tags. |
| pitching.md | "One pitch per agent per round", "Ties go to the earliest submission", "top 3 … share" | LIVE in the calculator (`rankRoundPitches`, `computeRoundPayouts`); no round run yet | Kept, labelled "fixed in the site's rewards calculator". The numbers come from config. |
| pitching.md | "Masters receive pitches and score them" | PLANNED | Tagged [[Planned]]: "Masters will receive pitches". The participation rule (built in `mastersTakingPart`) is described as already fixed. |
| pitching.md | "Every Master profile can show a preferred contact route" | INACCURATE (`contactRoute` is always null; the UI shows "Contact options coming soon") | [[Planned]] "will be able to show". |
| voting.md | "It opens 24 hours after the agent goes live" | INACCURATE (no vote submission exists; after the unlock the button says "Voting coming soon") | [[Planned]] "Vote submission is not built yet. It cannot open before 4 October 2026, 15:30 UTC". |
| voting.md | "When a round starts, the site records a snapshot block" | INACCURATE (no snapshot is recorded) | [[Planned]] "will record". |
| voting.md | "Every round publishes its snapshot block and the number of eligible wallets" | INACCURATE | "Each round will publish". |
| voting.md | "A Fighter's own owner wallet cannot vote for its own pitch" | INACCURATE (not in the calculator) | [[Planned]] "won't be able to". |
| voting.md | "Groups of wallets funded from a single source … are flagged for review" | INACCURATE (not built) | [[Planned]] "will be flagged". |
| voting.md | "Votes are stored off-chain and published in an audit log" | INACCURATE | [[Planned]] "will be stored … published". |
| voting.md | "at least **1,000 $ORBIO**" | LIVE value | "the voting minimum … currently **1,000 $ORBIO**" (configurable, from config). |
| voting.md | Voting power table | LIVE (`lib/voting.ts`) | Generated from `votingPower()` (`{{VOTING_POWER_TABLE}}`). |
| voting.md | (new) "My Wallet already shows whether your current balance meets the minimum" | LIVE (needs `RPC_URL` for the balance) | Added with a [[Live]] tag. |
| rewards.md | "The Tournament is funded by … $CREDIT" | INACCURATE (nothing is funded yet) | "is **planned** to be funded". |
| rewards.md | "(1 $CREDIT = $1 of AI usage)" | Orbio's claim, not ours | "Orbio describes one $CREDIT as one dollar of AI usage balance" (wording from Orbio's docs). |
| rewards.md | "The treasury belongs to the MooBot agent." | INACCURATE (there is no on-chain treasury) | "Moofield's policy … not enforced on-chain … an accounting figure the site displays, not a separate on-chain account". |
| rewards.md | "a hard cap per round (to be confirmed before launch)" | INACCURATE (launch is today; the cap is still `null`) | "currently not set yet; while it isn't set, the pool shows as n/a" (from config). |
| rewards.md | Worked example (hand-typed numbers) | LIVE maths | Generated by `rewardsWorkedExample()` from config and `computeRoundPayouts` (`{{REWARDS_WORKED_EXAMPLE}}`). The cap is marked "an example". |
| rewards.md | "Once voting opens, each wallet can see its accrued rewards as a ledger." | INACCURATE (the ledger card unlocks but nothing populates it) | [[Opens]] the ledger card; [[Planned]] entries "until rounds are scored". |
| rewards.md | "Masters can't earn from their own pitch." | Rule LIVE in the calculator; "earn" wording | "No Masters share for your own pitch". |
| rewards.md | (new) What "received" means | LIVE (after verification) | "the $CREDIT Orbio reports as claimed to the agent's wallet" (`credit.claimedAtoms`; see section 5). |
| faq.md | "When does voting open? 24 hours after the agent goes live" | INACCURATE | [[Planned]] "isn't built yet … can't open before". |
| faq.md | "Why is MooBot asleep? … sleeps until the agent goes live … sharing live updates" | Partly INACCURATE | "until go-live … shows live site facts: the next unlock, the number of Masters and the Tournament's status" (what `MooBotGuide.tsx` shows). |
| faq.md | "Does tapping MooBot earn anything? … It charges his power meter and can switch him into Super form" | INACCURATE (no tap meter or Super form; a tap only plays the flex gesture) | "Does tapping MooBot do anything? Tapping MooBot plays a little flex animation … [[Planned]] A tap meter". |
| faq.md | "What are the rewards paid in?" | INACCURATE (nothing is paid) | "What would rewards be counted in?" The split is labelled as a policy. |
| faq.md | (new) "Is an agent running yet?", "What is the holder aura?" | LIVE (switch and aura built; aura shows "Not launched yet") | Added. |
| glossary.md | "Field Fund: The total $CREDIT the MooBot agent has received" | LIVE after $MOOBOT is verified | "what Orbio reports as claimed to the agent's wallet … Shown once the official $MOOBOT contract is confirmed on Orbio". |
| glossary.md | "Graduated: … when Orbio marks it graduated in its agent list and its own record confirms it" | Close, but imprecise | The exact rule with `price.graduated` / `curve.graduated`; disagreeing agents are hidden. |
| glossary.md | "Masters receive pitches, score them, can post tenders" | INACCURATE | "will receive … post tenders". |
| glossary.md | "Treasury: The MooBot agent's reserve of $CREDIT" | INACCURATE | "An accounting figure the site displays … not a separate on-chain account". |
| glossary.md | Snapshot block, Tender | PLANNED | Future tense. Added Go-live and Holder aura entries. |
| safety.md | "built so that using it can never put your funds at risk" | INACCURATE (overclaim: phishing and lookalike sites remain a risk) | "never asks your wallet to send a transaction or approve a token, so the site itself cannot move your funds. Lookalike sites and fake addresses are still a risk …". |
| safety.md | "The code is checked before each release for any transaction or approval features." | LIVE (`npm run build` runs `check:readonly` first, and Netlify's build runs `npm run build`) | "Every build runs an automatic check … and the build fails if it finds any." |
| safety.md | "Reading your balances of $ORBIO and $MOOBOT" | Partly INACCURATE ($MOOBOT isn't launched) | "of $ORBIO, and of $MOOBOT once it is launched". |
| safety.md | "Signing a free message to sign in, and later to vote" | Sign-in LIVE, voting PLANNED | Split into [[Live]] and [[Planned]]. |
| safety.md | "Each round publishes its snapshot block … and a downloadable list" | INACCURATE | [[Planned]] "will publish". |
| safety.md | "Every data card shows when it was last updated" | Mostly LIVE (not every card has a timestamp) | "Data cards show when they were last updated". |
| safety.md | "Flashing effects stay well under three flashes per second and are switched off … reduced motion" | LIVE (the only looping animation is the 2.4 s sleep "z"; `prefers-reduced-motion` disables all animation in `globals.css`) | Kept, reworded. |
| safety.md | "Sound is off by default." | Misleading (the site has no sound at all) | "The site plays no sound." |
| safety.md | (stage 2) "How to verify the official $MOOBOT contract" | LIVE | Kept and tagged. |
| roadmap.md | "Live now: Field Fund, treasury and round pool overview" | LIVE (with figures n/a until verified) | Reworded. Added the $MOOBOT launch switch to Live now. |
| roadmap.md | "When the agent goes live … 24 hours after the agent goes live: The Tournament opens: pitching, voting and the rewards ledger" | INACCURATE | "At go-live", then [[Opens]] "board, leaderboard and rewards ledger card unlock, empty". Pitch submission, voting, Master profiles, tenders, ledger entries and the power meter are all [[Planned]]. |
| (index) `lib/docs.ts` | Rewards description "The 80/20 and 30/50/20 splits" | INACCURATE (left over from the old model) | "The 20/80 split, the round pool and a worked example. Displayed, not paid." (from config). |

## 3. Pages and components

| File | Quote (before) | Status | Fix |
|---|---|---|---|
| app/page.tsx (hero) | "New AI agents pitch features to graduated Orbio agents. The community votes, and the best idea of each round wins." | INACCURATE | "A tournament where new AI agents will pitch … and the community will vote … The Masters are live today; pitching and voting are on the way." |
| app/page.tsx (steps) | "Fighters pitch …", "$ORBIO holders vote …", "Every 72-hour round crowns one champion. The top 3 pitches, voters and Masters share the round pool" | INACCURATE | Future tense; "Rewards in Orbio $CREDIT will be displayed, not paid." The round length comes from config. |
| app/page.tsx (FAQ) | "Voting uses a free signed message." | INACCURATE | "Sign-in uses a free signed message." |
| app/page.tsx (FAQ) | "When does voting open? 24 hours after the agent goes live" | INACCURATE | "Vote submission isn't built yet. The Tournament unlocks 4 Oct 2026, 15:30 UTC, so voting can't open before then." |
| app/page.tsx (FAQ) | "Who can vote? … the minimum $ORBIO" | PLANNED | "Who will be able to vote? … (currently 1,000 $ORBIO, configurable)". |
| app/page.tsx | "Featured Masters … ready to hear pitches" | INACCURATE (no Master has opted in) | "Agents that graduated on the Orbio launchpad, read live from Orbio." |
| components/LaunchTimeline.tsx | "The agent goes live in", "The agent is live", "Give the agent time. Full features arrive 24 hours after the agent goes live." | INACCURATE | "Go-live in", "Live", "Go-live is the site's schedule. The Tournament unlocks 24 hours after it." |
| components/LaunchTimeline.tsx | "The Tournament opens: pitching, voting and the rewards ledger. Round 1 starts." | INACCURATE | "The Tournament board, leaderboard and rewards ledger unlock, and the Round 1 clock starts. Pitch and vote submission are still being built." |
| lib/schedule.ts | Next-milestone label "Agent goes live" | INACCURATE | "Go-live". |
| components/MooBotGuide.tsx | "Shh, I'm resting until the agent goes live." / "opens 24 hours after I go live." | INACCURATE | "until go-live" / "opens 24 hours after go-live" (from config). |
| components/MeetMooBot.tsx | "Tap MooBot enough and he powers up for a short burst." | INACCURATE (no tap meter) | "Coming soon: a tap meter that powers him up for a short burst." |
| components/MeetMooBot.tsx | "It never earns or unlocks anything of value." | LIVE, "earn" wording | "never gives or unlocks". |
| app/tournament/page.tsx | "Fighters pitch features to Masters, and the Crowd votes. Each 72-hour round crowns one champion." | INACCURATE | Future tense, plus "Pitch and vote submission are still being built." |
| app/tournament/page.tsx | Lock card "Pitching, voting and the rewards ledger open 24 hours after the agent goes live." | INACCURATE | "The Tournament board unlocks 24 hours after go-live. Pitch and vote submission ship after that." |
| components/tournament/RoundCountdown.tsx | "Voting opens in" (before round 1), "One champion per round." | INACCURATE | "Round 1 starts in"; "Rounds last 72 hours." (from config). |
| components/tournament/VoteButton.tsx | "Voting opens in HH:MM:SS" (before the unlock) | INACCURATE (voting won't open then) | "Tournament opens in …", then "Voting coming soon". |
| components/tournament/EmptyStates.tsx | "When a Master posts a request for Fighters, it appears here." | INACCURATE | "Tenders are on the way: Masters will be able to post requests …". |
| components/tournament/EmptyStates.tsx | "Rankings appear here as soon as the Crowd starts voting" | INACCURATE | "will appear here once vote submission ships …". |
| components/tournament/EmptyStates.tsx | "No pitches yet, be the first" / "Pitch submission opens soon" | LIVE (the empty state is real; submission is PLANNED and says so) | Kept (your wording). |
| app/leaderboard/page.tsx | "Pitches are ranked … Each wallet casts one vote per round." / lock card "Voting opens in" / "Rankings go live 24 hours after the agent goes live" | INACCURATE | "will be ranked … will get one vote … Vote submission is still being built."; "The leaderboard opens in"; "unlocks 24 hours after go-live, and fills once voting is built". |
| app/credits/page.tsx | Title "The Credit Market", section "Market activity" | INACCURATE (there is no market) | "Where the $CREDIT goes" / "$CREDIT activity". |
| app/credits/page.tsx | "Rewards are counted in … (1 $CREDIT = $1 of AI usage). Of the $CREDIT the MooBot agent receives, 20% runs the agent first and 80% goes to the treasury." | INACCURATE as a fact | "would be counted in … (Orbio describes one $CREDIT as one dollar of AI usage balance). Moofield's policy, not an on-chain rule … an accounting figure shown here. Nothing is paid out." |
| app/credits/page.tsx | "Market data appears here once the MooBot agent is live on Orbio." | INACCURATE (no per-agent history source exists even after verification) | "Planned: a day-by-day history … Orbio doesn't publish a per-agent history yet". |
| app/credits/page.tsx | Guards: "A Master can't earn from its own pitch.", "Round 1 starts 24 hours after the agent goes live." | Rules LIVE in the calculator; wording | "These rules are fixed in the rewards calculator. No round has been scored yet."; "A Master gets no Masters share in a round where it is the Fighter behind a top-3 pitch."; "after go-live". |
| app/credits/page.tsx, FieldFund.tsx, `NA_REASONS.moobotAgent` | "once the MooBot agent is live on Orbio" | INACCURATE (the switch is the verified $MOOBOT contract) | "once the official $MOOBOT contract is confirmed on Orbio". |
| components/FieldFund.tsx | "$CREDIT received" from `credit.mintedAtoms` | INACCURATE source (`mintedAtoms` isn't documented by Orbio) | Now `credit.claimedAtoms`. Orbio documents that `claimAgentCredit` sends accrued $CREDIT to the agent wallet. |
| app/masters/page.tsx | "An agent is listed only when Orbio marks it graduated and its own record confirms it." | Imprecise | The exact rule, the hide-on-disagree behaviour, and "Refreshed when someone visits, at most every 3 minutes." |
| app/masters/[token]/page.tsx | "Masters choose how Fighters reach them" | INACCURATE | "Masters will be able to choose". |
| components/wallet/WalletDashboard.tsx | "See your $ORBIO and $MOOBOT balances … and whether you can vote." | INACCURATE | "your $MOOBOT balance once it launches … whether you meet the voting minimum". |
| components/wallet/WalletDashboard.tsx | "Rewards … appear here after each round ends." | INACCURATE | "will appear here once rounds are scored. Displayed, not paid." |
| components/LegalPage.tsx | "this page is being finalised and will be reviewed before launch" | INACCURATE (launch is today, no review done) | "this page has not had a legal review yet. Last updated 3 October 2026." |
| app/terms/page.tsx | "The date of the latest version will be shown here." | INACCURATE (no date was shown) | The date is now shown at the top. |
| app/privacy/page.tsx | "When wallet connection opens, the site reads public balances … may store signed messages (such as votes)" | INACCURATE (connection is open; sign-in messages aren't stored; votes don't exist) | "When you connect a wallet, the site reads public balances … Signing in checks a free signed message and is not stored; once voting is built, votes will be stored as signed messages." |
| app/privacy/page.tsx | "stores a few small preferences … such as MooBot's position" | INACCURATE (omitted the session and wallet cookies) | Now lists MooBot's position, the wallet connection, and the sign-in session cookie (up to a day: `AUTH.sessionTtlMs`). |
| app/privacy/page.tsx | "Contact details will be listed here before launch." | INACCURATE | "Reach the project on X at @moofield". |
| Footer, Docs sidebar (stage 1) | X @moofield link; Telegram and Discord "Coming soon"; disclaimer | LIVE | Kept. |
| OfficialMooBotCard, MooBotAgentCard, Status, My Wallet (stage 2) | "Not launched yet", "Official $MOOBOT contract", verify steps, aura | LIVE (switch built; empty until `MOOBOT_TOKEN_ADDRESS` is set and verified) | Kept. |

## 4. API response labels

| Route | Label (before) | Status | Fix |
|---|---|---|---|
| `/api/rounds/current` | `votingOpen: true` after the unlock | INACCURATE (no voting exists) | Renamed `tournamentUnlocked`. Added `pitchSubmission: "planned"` and `voteSubmission: "planned"`. Test updated. |
| `/api/status` | `mode: "chain"` | INACCURATE (Masters come from the Orbio API, not the chain) | `mode: "live"` (or `"mock"`). |
| `/api/pitches`, `/api/tenders`, `/api/leaderboard` | `source: "live"`, `data: []` | LIVE (a real, empty state; never sample data) | Kept. |
| `/api/credits` | `source: "unavailable"` until $MOOBOT is verified | LIVE | Kept. |
| `/api/moobot` (stage 2) | `status: not-launched / invalid / not-found / unverified / verified` | LIVE | Kept. |
| `/api/cron/scan` | Doc comment "Point a cron job … every few minutes" | INACCURATE (no scheduler is configured) | The comment now says no scheduler is configured and the refresh is on demand. |

## 5. Data source changes found during the audit

- **Field Fund "$CREDIT received":** changed from the undocumented `credit.mintedAtoms` to the documented `credit.claimedAtoms`. The agent card also shows `credit.owedAtoms` ("accrued, not yet claimed"). On the errand record used in the tests, `mintedAtoms` is 6,057.65 $CREDIT while `claimedAtoms` is 0. Showing `mintedAtoms` as "received" would have been a guess.

## 6. Word search

Searched all pages, components and Docs for: guaranteed, profit, returns, passive income, earn, risk-free, safe, official.

| Word | Hits after the fixes | Decision |
|---|---|---|
| guaranteed | "Rewards are not guaranteed" (footer, Terms, Credits, Rewards, Safety); FAQ heading "Are rewards guaranteed?" (answered "No.") | **Kept**: disclaimers. A test allows "guarantee" only in these phrases. |
| returns | "not … a promise of returns" (footer, Terms, Safety) | **Kept**: disclaimer. A test allows only "promise of returns". |
| profit, passive income, risk-free | None | A test and the smoke test forbid them. |
| earn | Removed: "Masters can't earn …", "Does tapping MooBot earn anything?", "never earns" | **Removed** (reworded with "share", "gives", "do anything"). A test and the smoke test forbid `\bearn`. |
| safe | "never put your funds at risk" (an overclaim, removed). "Safety and transparency" (page title) and `safetyLine` (code) remain. | **Removed** the claim. The title is kept: it names the topic and makes no promise. The smoke test forbids the word "safe" in visible text. |
| official | "Official $MOOBOT contract" card, the verify section, "once the official $MOOBOT contract is confirmed on Orbio" | **Kept, justified:** you asked for this card, and it only shows an address after the format, checksum and Orbio checks pass. Until then it says "Not launched yet". |

## 7. Docs numbers come from config

- **Placeholders:** every number in the Docs is a `{{NAME}}` placeholder filled in from `config.ts` by `lib/doc-vars.ts`. This covers:
  - the go-live, unlock and Round 1 end dates;
  - the 24h unlock and 72h round;
  - the vote minimum and voting power model;
  - the 20/80, 25%, 35/10/10/45, top 3 and 50/30/20 splits;
  - the voter cap, minimum voters, minimum payout, repeat-winner share and rounds, and the Masters minimum;
  - the 3-minute refresh, the aura tiers and the Orbio links.
- **Generated sections:** the voting power table and the whole worked example are generated by the real `votingPower()` and `computeRoundPayouts()`.
- **Tests (`tests/docs.test.ts`):**
  - the raw markdown contains no hand-typed digits (only list markers and the name "Round 1");
  - every placeholder resolves;
  - the rendered Docs state the current config values;
  - changing a value (vote minimum, round split) changes the Docs;
  - every page but the glossary has status tags;
  - the word rules hold.

## Changelog

- Launch delayed 90 minutes on 3 Oct 2026: go-live 15:30 UTC.
- Netlify deployment added on 3 Oct 2026. `netlify.toml` now exists, and the scheduled function `netlify/functions/refresh-orbio.mjs` calls `/api/cron/scan` every 3 minutes with `CRON_SECRET`. This supersedes the "no scheduler" answers above. Visits still refresh on demand as well.
- Sample data is now forced off in production: `USE_MOCK_DATA` is only honoured when `NODE_ENV` isn't `production`.
