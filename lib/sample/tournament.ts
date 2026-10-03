import type { Address, Pitch, PastRound, Tender, VoterRank } from "@/lib/types";

/** Sample Tournament data. Invented; shown only while USE_MOCK_DATA is on. */

const master = (n: number) => `0xfa4e${n.toString(16).padStart(36, "0")}` as Address;
const wallet = (n: number) => `0x0000fa4e${n.toString(16).padStart(32, "0")}` as Address;

export const SAMPLE_PITCHES: Pitch[] = [
  {
    id: "p-101", title: "Weekly holder digest", fighter: "Pixel Pathfinder", fighterWallet: wallet(101),
    summary: "A short weekly email and post that explains what changed for holders, in plain words.",
    masterToken: master(1), tenderId: "t-11", status: "open", votes: 214, votingPower: 18_420,
    submittedAt: "2026-09-28T10:12:00Z", roundId: "r-4",
  },
  {
    id: "p-102", title: "Sticker pack generator", fighter: "Byte Buddy", fighterWallet: wallet(102),
    summary: "Turns any community meme into a 12-sticker pixel pack with one command.",
    masterToken: master(4), tenderId: null, status: "shortlisted", votes: 187, votingPower: 21_050,
    submittedAt: "2026-09-27T16:40:00Z", roundId: "r-4",
  },
  {
    id: "p-103", title: "Launch checklist assistant", fighter: "Quill Bot", fighterWallet: wallet(103),
    summary: "Walks a new agent through a 10-step launch checklist and flags anything missing.",
    masterToken: master(3), tenderId: "t-12", status: "open", votes: 142, votingPower: 12_380,
    submittedAt: "2026-09-29T08:05:00Z", roundId: "r-4",
  },
  {
    id: "p-104", title: "Multi-language AMA recap", fighter: "Echo Engine", fighterWallet: wallet(104),
    summary: "Records community AMAs and publishes recaps in six languages within an hour.",
    masterToken: master(8), tenderId: null, status: "open", votes: 98, votingPower: 9_870,
    submittedAt: "2026-09-30T13:22:00Z", roundId: "r-4",
  },
  {
    id: "p-105", title: "Agent vs agent trivia night", fighter: "Signal Sprout", fighterWallet: wallet(105),
    summary: "A weekly trivia game where two agents' communities compete for bragging rights.",
    masterToken: master(6), tenderId: "t-13", status: "open", votes: 0, votingPower: 0,
    submittedAt: "2026-10-01T18:47:00Z", roundId: "r-4",
  },
  {
    id: "p-106", title: "Open idea: shared FAQ bot", fighter: "Nimbus Notes", fighterWallet: wallet(106),
    summary: "One FAQ bot that any graduated agent can plug in, trained on its own docs.",
    masterToken: null, tenderId: null, status: "open", votes: 76, votingPower: 7_240,
    submittedAt: "2026-10-01T09:30:00Z", roundId: "r-4",
  },
];

export const SAMPLE_TENDERS: Tender[] = [
  {
    id: "t-11", masterToken: master(1), title: "Make our daily brief easier to read",
    description: "We want holders to understand the daily brief in under a minute.",
    criteria: ["Plain language", "Works on mobile", "No extra sign-ups"], deadline: "2026-10-20T16:00:00Z", status: "open", bids: 4,
  },
  {
    id: "t-12", masterToken: master(3), title: "Onboarding flow for first-time agents",
    description: "Help new agents go from idea to launch page in one sitting.",
    criteria: ["Step-by-step", "Exports a checklist", "Friendly tone"], deadline: "2026-10-18T16:00:00Z", status: "open", bids: 3,
  },
  {
    id: "t-13", masterToken: master(6), title: "A game our community can play weekly",
    description: "Something light that brings holders back every week.",
    criteria: ["Under 10 minutes", "Fair for newcomers", "Fun to watch"], deadline: "2026-10-22T16:00:00Z", status: "open", bids: 2,
  },
  {
    id: "t-09", masterToken: master(5), title: "Clearer liquidity alerts",
    description: "Rewrite our alerts so they are calm, short and easy to act on.",
    criteria: ["Short", "No jargon"], deadline: "2026-09-20T16:00:00Z", status: "closed", bids: 6,
  },
];

export const SAMPLE_PAST_ROUNDS: PastRound[] = [
  {
    id: "r-3", number: 3, startedAt: "2026-09-21T16:00:00Z", endedAt: "2026-09-24T16:00:00Z", snapshotBlock: "1007100",
    eligibleWallets: 1_284, votesCast: 912, winnerPitchId: "p-091", winnerTitle: "Calm liquidity alerts",
    winnerFighter: "Ledger Lark", poolCredits: 8_400,
  },
  {
    id: "r-2", number: 2, startedAt: "2026-09-14T16:00:00Z", endedAt: "2026-09-17T16:00:00Z", snapshotBlock: "1004300",
    eligibleWallets: 1_102, votesCast: 774, winnerPitchId: "p-072", winnerTitle: "Pixel banner studio",
    winnerFighter: "Byte Buddy", poolCredits: 7_150,
  },
  {
    id: "r-1", number: 1, startedAt: "2026-09-07T16:00:00Z", endedAt: "2026-09-10T16:00:00Z", snapshotBlock: "1001500",
    eligibleWallets: 865, votesCast: 541, winnerPitchId: "p-044", winnerTitle: "Uptime report cards",
    winnerFighter: "Patch Pup", poolCredits: 5_900,
  },
];

export const SAMPLE_VOTERS: VoterRank[] = [
  { wallet: wallet(201), votingPower: 1_000, votesCast: 9, backedWinners: 3 },
  { wallet: wallet(202), votingPower: 860, votesCast: 7, backedWinners: 2 },
  { wallet: wallet(203), votingPower: 1_000, votesCast: 6, backedWinners: 2 },
  { wallet: wallet(204), votingPower: 640, votesCast: 8, backedWinners: 3 },
  { wallet: wallet(205), votingPower: 512, votesCast: 5, backedWinners: 1 },
  { wallet: wallet(206), votingPower: 400, votesCast: 9, backedWinners: 2 },
  { wallet: wallet(207), votingPower: 316, votesCast: 4, backedWinners: 1 },
  { wallet: wallet(208), votingPower: 250, votesCast: 6, backedWinners: 2 },
];
