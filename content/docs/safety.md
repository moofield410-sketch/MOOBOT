# Safety and transparency

Moofield never asks your wallet to send a transaction or approve a token, so the site itself cannot move your funds. Lookalike sites and fake addresses are still a risk anywhere in crypto: the steps below help you check what you're looking at.

## The site never moves funds

[[Live]]

- It **never sends transactions** on your behalf.
- It **never asks for token approvals**, so no contract can spend your tokens through this site.
- It **never asks for your seed phrase** or private keys. Nobody from Moofield will ever ask for them.

Every build runs an automatic check of the code for transaction, approval and wallet-write features, and the build fails if it finds any.

## What a wallet is used for

Your wallet is used for these things only:

1. [[Live]] **Reading your balances** of $ORBIO, and of $MOOBOT once it is launched. Reading is public and harmless.
2. [[Live]] **Signing a free message** to sign in, and [[Opens]] to pitch, vote, score or post a tender. Every message says in plain text: "This signature costs no gas and cannot move funds.", and shows exactly what you are agreeing to.

If your wallet ever shows a transaction or an approval request while you use this site, **reject it** and close the site.

## How to verify the official $MOOBOT contract

> **Ignore any other address.** Scammers post fake token addresses in replies, DMs and lookalike sites. The only $MOOBOT address to trust is the one shown on this site, and only once it says it is confirmed on Orbio.

[[Live]] $MOOBOT has **not launched yet** until the address appears here. When it does:

1. **Find it on this site only.** The "Official $MOOBOT contract" card on the home page, in the footer and in the Docs sidebar shows the address with a **Copy address** button. If the card says "Not launched yet", there is no official $MOOBOT contract, whatever anyone tells you.
2. **Check it is confirmed on Orbio.** The card only shows an address after the site has looked it up on Orbio's public agent API and found a matching agent. The [Status](/status) page shows the same check, and warns if a configured address was rejected.
3. **Check it on the block explorer.** Use the card's **View on explorer** link, which opens the token on robin.etherscan.io. Compare every character of the address, not just the first and last few.
4. **Copy, don't retype.** Use the Copy address button, then compare again wherever you paste it.

Moofield will never DM you an address, ask you to "verify" a wallet, or ask for a token approval.

## Everything is checkable

- [[Live]] The Masters list comes from the agent data of Orbio ([@orbiodotso](https://x.com/orbiodotso)), refreshed when someone visits (at most every {{MASTERS_REFRESH_MIN}} minutes), and each Master links to its token on the block explorer.
- [[Opens]] Each round publishes its snapshot block and an audit log of every signed pitch, vote and score, so anyone can re-check the signatures.
- [[Planned]] A count and downloadable list of every wallet eligible at the snapshot.
- [[Live]] Data cards show when they were last updated, and warn you if the data may be out of date.
- [[Live]] Figures that aren't available show **n/a** with a short reason. Nothing is invented.
- [[Live]] The [Status](/status) page shows the health of the data sources and the $MOOBOT contract check.
- [[Live]] Times on the site follow the server clock and are shown in UTC.

## Comfortable for everyone

- [[Live]] Animations are switched off if your device has reduced motion turned on, and nothing flashes faster than three times per second.
- [[Live]] The site plays no sound.
- [[Live]] The site works on small phones and with a keyboard.

## Not financial advice

Nothing on this site is financial advice, an offer or a promise of returns. Rewards are displayed, not paid, and are not guaranteed. Legal review comes before any real payout. Moofield is an independent community project, not affiliated with Orbio.
