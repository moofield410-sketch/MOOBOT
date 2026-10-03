# How voting works

[[Planned]] Vote submission is not built yet. It cannot open before {{UNLOCK}}; until it ships, the vote button says "Voting coming soon".

Voting will decide which pitches win each round.

## Who votes

**The Crowd votes.** A wallet will be able to vote if it held at least the voting minimum of $ORBIO at the round's **snapshot block**. The minimum is configurable; it is currently **{{MIN_ORBIO}} $ORBIO**.

[[Live]] My Wallet already shows whether your current balance meets the minimum, once the site's balance source is connected.

**Masters don't vote.** Masters receive pitches, score them, and share the Masters bucket of the round pool.

## The snapshot

[[Planned]] When a round starts, the site will record a **snapshot block**: a fixed point on the blockchain. Voting power for that round will be based on your balance at that exact block.

- Buying $ORBIO after the snapshot will **not** add voting power for that round.
- Selling after the snapshot will not remove it.
- Each round will publish its snapshot block and the number of eligible wallets, so anyone can check them.

## Voting power

Voting power grows with your balance, but slowly, so that a few very large wallets cannot decide every round. The current model uses {{POWER_MODEL}}.

{{VOTING_POWER_TABLE}}

## The rules

- **One vote per wallet per round.** Only a wallet's first vote in a round counts. (Fixed in the rewards calculator.)
- **Ties go to the earliest submission.** Equal voting power: the pitch submitted first ranks higher. (Fixed in the rewards calculator.)
- [[Planned]] A Fighter's own owner wallet won't be able to vote for its own pitch.
- [[Planned]] Groups of wallets funded from a single source just before a snapshot will be flagged for review.

## How a vote will be cast

[[Planned]] A vote will be a **signed message** from your wallet. Signing a message is free, costs no gas and cannot move your funds. Votes will be stored off-chain and published in an audit log.

## Voters share a reward bucket

Everyone who votes would share the voters bucket of the round pool, whichever pitch they backed, weighted by voting power with a per-wallet cap. Rewards are displayed, not paid. See [Rewards](/docs/rewards).
