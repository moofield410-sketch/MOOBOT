import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CACHE, DISCLAIMER, FULL_UNLOCK_AFTER_H, ORBIO_LINKS, ORBIO_SOCIAL, REWARDS, SOCIAL, TOURNAMENT, VOTING } from "@/config";
import { docVars, rewardsWorkedExample } from "@/lib/doc-vars";
import { DOCS, extractHeadings, indexDoc, renderDocTemplate, searchDocs, slugify, stripMarkdown } from "@/lib/docs";
import { CREDIT, computeRoundPayouts, credits, roundPool, splitReceived, type RoundPitch } from "@/lib/rewards";
import { votingPower } from "@/lib/voting";
import { readDoc } from "@/lib/docs.server";

/** The markdown as written (placeholders and tags). */
const read = (slug: string) => readFileSync(`content/docs/${slug}.md`, "utf8");
/** The markdown as served, with every number filled in from config. */
const rendered = (slug: string) => readDoc(slug)!;
const n = (atoms: bigint) => (atoms / CREDIT).toLocaleString("en-US");

describe("docs", () => {
  it("has a markdown file for every docs page, with the required pages present", () => {
    for (const d of DOCS) assert.ok(existsSync(`content/docs/${d.slug}.md`), `missing ${d.slug}.md`);
    assert.deepEqual(
      DOCS.map((d) => d.title),
      ["Getting started", "How pitching works", "How voting works", "Rewards", "FAQ", "Glossary", "Safety and transparency", "Roadmap"],
    );
  });

  it("extracts headings with stable anchor ids", () => {
    const h = extractHeadings(read("voting"));
    assert.ok(h.some((x) => x.id === "the-snapshot" && x.level === 2));
    assert.equal(slugify("Step 1: the 20/80 split"), "step-1-the-2080-split");
  });

  it("strips markdown syntax for search", () => {
    assert.equal(stripMarkdown("**Bold** and [a link](/x) | `code`"), "Bold and a link code");
  });

  it("finds pages and sections by keyword", () => {
    const index = DOCS.flatMap((d) => indexDoc(d, rendered(d.slug)));
    const snapshot = searchDocs(index, "snapshot block");
    assert.deepEqual(snapshot.slice(0, 2).map((r) => r.slug).sort(), ["glossary", "voting"]);
    assert.ok(searchDocs(index, "approvals").some((r) => r.slug === "safety"));
    assert.ok(searchDocs(index, "treasury").some((r) => r.href.startsWith("/docs/rewards")));
    assert.deepEqual(searchDocs(index, "x"), []);
    assert.deepEqual(searchDocs(index, "nothing-matches-this"), []);
  });

  it("never mentions $MOOBOT trading fees or 'after launch'", () => {
    for (const d of DOCS) {
      const md = read(d.slug);
      assert.ok(!/trading fees/i.test(md), `${d.slug} mentions trading fees`);
      assert.ok(!/after launch/i.test(md), `${d.slug} says "after launch"`);
    }
  });

  it("states the confirmed rules and drops the voting toggle", () => {
    assert.match(read("voting"), /One vote per wallet per round/);
    assert.match(read("voting"), /Ties go to the earliest submission/);
    assert.match(read("pitching"), /One pitch per agent per round/);
    assert.ok(!/voting (is )?switched on|toggle/i.test(read("pitching") + read("voting")));
  });

  it("the Rewards worked example matches the real rewards code", () => {
    const md = rendered("rewards");
    const received = splitReceived(credits(10_000));
    const plan = roundPool(credits(2_000));
    const small = roundPool(credits(100));
    const pool = plan.pool;

    const pitch = (id: string, fighter: string, minute: number): RoundPitch => ({
      id,
      fighter,
      fighterOwner: `0x${(100 + minute).toString(16).padStart(40, "0")}`,
      submittedAt: `2026-10-04T15:${String(minute).padStart(2, "0")}:00Z`,
    });
    const wallet = (i: number) => `0x${(1_000 + i).toString(16).padStart(40, "0")}` as const;
    const votes = [
      { wallet: wallet(0), pitchId: "p1", power: 1_000 },
      ...Array.from({ length: 9 }, (_, i) => ({ wallet: wallet(i + 1), pitchId: i < 5 ? "p2" : "p3", power: 100 })),
    ];
    const masters = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, agentId: i === 0 ? "A" : `master-${i}`, ownerWallet: wallet(50 + i) }));
    const pitches = [pitch("p1", "A", 1), pitch("p2", "B", 2), pitch("p3", "C", 3)];
    const payouts = computeRoundPayouts({ pool, pitches, votes, masters, scores: [], tenders: masters.map((m) => ({ masterId: m.id, pitchCount: 1 })), recentTop3: [] });

    const expected = [received.agentOps, received.treasury, plan.share, pool, small.share, small.devTopUp, small.pool, ...payouts.pitches.map((p) => p.amount), payouts.voters[0].amount, payouts.masters[0].amount];
    for (const v of expected) assert.ok(md.includes(n(v)), `rewards.md should mention ${n(v)}`);

    assert.equal(plan.share, credits(1_200), "60% of the treasury");
    assert.equal(plan.devTopUp, 0n);
    assert.equal(small.pool, credits(REWARDS.roundPoolFloorCredits), "the dev tops a small treasury up to the floor");
    assert.equal(small.share + small.devTopUp, small.pool);
  });


  it("the voting power table matches the voting code", () => {
    const md = rendered("voting");
    for (const balance of [10_000, 160_000, 250_000, 1_000_000]) {
      const row = `| ${balance.toLocaleString("en-US")} $ORBIO | ${votingPower(balance).toLocaleString("en-US")} |`;
      assert.ok(md.includes(row), `voting.md row for ${balance}`);
    }
    assert.equal(votingPower(999), 0);
  });

  it("credits Orbio with a link to its X account on every page that mentions Orbio", () => {
    const credit = `Orbio ([${ORBIO_SOCIAL.xHandle}](${ORBIO_SOCIAL.x}))`;
    for (const d of DOCS) {
      const md = read(d.slug);
      if (!/(^|[^$])\bOrbio\b/m.test(md)) continue;
      assert.ok(md.includes(credit), `${d.slug} mentions Orbio without crediting ${ORBIO_SOCIAL.xHandle}`);
    }
  });

  it("links only the confirmed X account and keeps the other socials empty", () => {
    assert.equal(SOCIAL.x, "https://x.com/M00FIELD");
    assert.equal(SOCIAL.xHandle, "@M00FIELD");
    assert.equal(SOCIAL.telegram, null);
    assert.equal(SOCIAL.discord, null);
    assert.equal(DISCLAIMER, "Independent community project, not affiliated with Orbio. Not financial advice.");
  });

  it("docs state the configured go-live and unlock dates", () => {
    assert.match(rendered("getting-started"), /4 October 2026, 12:00 UTC/);
    assert.match(rendered("voting"), /5 October 2026, 12:00 UTC/);
  });
});

describe("docs numbers come from config.ts", () => {
  /**
   * Digits allowed in the raw markdown: ordered-list markers and the name "Round 1". Every other
   * number (hours, dates, percentages, minimums, splits, the worked example) must be a {{NAME}}.
   */
  const ALLOWED = [/^\s*\d+\.\s/gm, /\bRound 1\b/g];

  it("the raw markdown contains no hand-typed numbers", () => {
    for (const d of DOCS) {
      let md = read(d.slug).replace(/\{\{[A-Z0-9_]+\}\}/g, "").replace(/\]\([^)]*\)/g, "]()");
      for (const re of ALLOWED) md = md.replace(re, "");
      const line = md.split("\n").find((l) => /\d/.test(l));
      assert.equal(line, undefined, `${d.slug}.md has a hand-typed number: "${line?.trim()}"`);
    }
  });

  it("every placeholder resolves", () => {
    const vars = docVars();
    for (const d of DOCS) {
      for (const [, name] of read(d.slug).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) assert.ok(name in vars, `${d.slug}.md uses unknown {{${name}}}`);
      assert.ok(!/\{\{|\}\}|\[\[/.test(rendered(d.slug)), `${d.slug} has an unresolved placeholder or tag`);
    }
  });

  it("the rendered docs state the current config values", () => {
    const all = DOCS.map((d) => rendered(d.slug)).join("\n");
    for (const expected of [
      `${VOTING.minOrbio.toLocaleString("en-US")} $ORBIO`,
      `${TOURNAMENT.roundLengthH} hours`,
      `${FULL_UNLOCK_AFTER_H} hours after go-live`,
      `${REWARDS.agentOpsPct}% runs the agent first`,
      `| ${REWARDS.roundSplit.pitchesPct}% | Pitches`,
      `round pool = max(${REWARDS.roundPoolPctOfTreasury}% × treasury, ${REWARDS.roundPoolFloorCredits.toLocaleString("en-US")} $CREDIT)`,
      `the other ${100 - REWARDS.roundPoolPctOfTreasury}% rolls over`,
      `${REWARDS.roundPoolPctOfTreasury}% of the treasury balance`,
      REWARDS.pitchPlaces.join(" / "),
      `at most every ${Math.round(CACHE.mastersTtlMs / 60_000)} minutes`,
    ]) {
      assert.ok(all.includes(expected), `docs should say "${expected}"`);
    }
  });

  it("changing a config value changes the docs (no drift)", () => {
    const vars = docVars();
    const raw = read("voting");
    const changed = renderDocTemplate(raw, { ...vars, MIN_ORBIO: "5,000" });
    assert.ok(changed.includes("**5,000 $ORBIO**"));
    assert.ok(!changed.includes(`${VOTING.minOrbio.toLocaleString("en-US")} $ORBIO**`));

    // A different round split changes the worked example, computed by the real rewards code.
    const otherSplit = { ...REWARDS, roundSplit: { pitchesPct: 40, votersPct: 10, mastersPct: 10, treasuryPct: 40 } } as unknown as typeof REWARDS;
    const other = rewardsWorkedExample(otherSplit);
    // 60% of the example's 2,000 $CREDIT treasury is a 1,200 pool; 40% of it is 480.
    assert.ok(other.includes("| Pitches | 40% | 480 |"), other);
    assert.ok(other.includes("| Stays in the treasury | 40% | 480 |"), other);
    assert.notEqual(other, rewardsWorkedExample());
  });

  it("every Docs page except the glossary tags its features as Live, Opens or Planned", () => {
    for (const d of DOCS.filter((x) => x.slug !== "glossary")) {
      assert.match(read(d.slug), /\[\[(Live|Opens|Planned)\]\]/, `${d.slug}.md has no status tag`);
    }
    assert.ok(rendered("roadmap").includes("`status:Opens 5 October 2026, 12:00 UTC`"), "Opens tags carry the configured date");
  });
});

describe("docs wording", () => {
  const all = () => DOCS.map((d) => ({ slug: d.slug, md: rendered(d.slug) }));

  it("never promises profit, returns, income or safety", () => {
    for (const { slug, md } of all()) {
      for (const re of [/profit/i, /passive income/i, /risk[- ]free/i, /\bearn(s|ed|ing)?\b/i, /\bsafe\b/i]) {
        assert.ok(!re.test(md), `${slug} contains ${re}: "${md.match(re)?.[0]}"`);
      }
      // "returns" and "guaranteed" only ever appear in disclaimers.
      for (const m of md.matchAll(/[^.\n]*\b(returns|guarantee\w*)\b[^.\n]*/gi)) {
        assert.match(m[0], /promise of returns|not guaranteed|Are rewards guaranteed/i, `${slug}: "${m[0].trim()}"`);
      }
    }
  });

  it("doesn't claim an agent is running at go-live", () => {
    for (const { slug, md } of all()) assert.ok(!/agent goes live|agent is live|I go live/i.test(md), `${slug} says the agent goes live`);
  });

  it("states how winners are paid (by the team, by hand, after each round), and that the split is a policy", () => {
    const md = rendered("rewards");
    assert.match(md, /paid by the team after each round/);
    assert.match(md, /never sends anything/);
    assert.match(md, /at least/);
    assert.match(md, /policy/);
    assert.match(md, /not enforced on-chain/);
    assert.ok(md.includes(ORBIO_LINKS.liveTerms), "links Orbio's live terms instead of restating its fee split");
  });

  it("states the code's exact graduation rule", () => {
    const g = rendered("glossary");
    assert.ok(g.includes("`price.graduated`") && g.includes("`curve.graduated`") && /disagree, the agent is hidden/.test(g));
  });
});
