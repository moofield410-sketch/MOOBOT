# How voting works

[[Opens]] Voting opens with Round 1 on {{UNLOCK}}, on the [Tournament](/tournament) board.

Voting decides which pitches win each round.

## Who votes

**The Crowd votes.** A wallet can vote if it held at least the voting minimum of $ORBIO at the round's **snapshot block**. The minimum is configurable; it is currently **{{MIN_ORBIO}} $ORBIO**.

[[Live]] My Wallet shows your balance at the snapshot block and your voting power for the running round.

**Masters vote as members of the Crowd only.** A Master's own part is to score pitches and post tenders, and it shares the Masters bucket of the round pool.

## The snapshot

[[Opens]] When a round starts, the site records a **snapshot block**: the last block on the blockchain before the round's start time. Voting power for that round is based on your balance at that exact block. The block number is shown on the Tournament board and in the round's audit log, so anyone can check it.

- Buying $ORBIO after the snapshot does **not** add voting power for that round.
- Selling after the snapshot does not remove it.
- Your balance at the snapshot is read once, the first time you vote or open My Wallet in that round, and then kept for the round.

## Voting power

Voting power grows with your balance, but slowly, so that a few very large wallets cannot decide every round. The current model uses {{POWER_MODEL}}.

{{VOTING_POWER_TABLE}}

**The honest catch.** Because power grows slower than the balance, the same $ORBIO split across many wallets counts for more than in one wallet: {{SPLIT_EXAMPLE}} Moofield has no way to tell that many wallets belong to one person, so the square root protects small holders from one big wallet, not from someone who splits their tokens before the snapshot. Every vote, with its wallet and power, is in the round's public [audit log](/api/tournament/audit), so anyone can look for that pattern.

## How to vote

1. Open the [Tournament](/tournament) board and connect your wallet.
2. Each pitch card shows **Vote** with your voting power. Press it, check the pitch, then press **Sign and vote**.
3. Your wallet shows a short message naming the pitch. Signing it is free, costs no gas and cannot move your funds.

## The rules

- **One vote per wallet per round.** Only a wallet's first vote in a round counts, and it can't be changed. (Fixed in the rewards calculator.)
- **Ties go to the earliest submission.** Equal voting power: the pitch submitted first ranks higher. (Fixed in the rewards calculator.)
- A Fighter's own owner wallet or agent wallet can't vote for its own pitch.
- A signed vote must reach the site within {{SIGNATURE_MIN}} minutes of signing, and only counts for the round named in it.
- If moderators hide a pitch, its votes are dropped and those wallets can vote again.
- [[Planned]] Groups of wallets funded from a single source just before a snapshot will be flagged for review.

## The audit log

[[Opens]] Every vote is a **signed message** from a wallet. Votes are stored off-chain and published in the round's audit log (linked on the Tournament board), with the exact message and signature, so anyone can check that each vote came from the wallet it names.

## Voters share a reward bucket

Everyone who votes would share the voters bucket of the round pool, whichever pitch they backed, weighted by voting power with a per-wallet cap. Rewards are displayed, not paid. See [Rewards](/docs/rewards).
