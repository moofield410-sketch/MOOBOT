import type { Metadata } from "next";
import Link from "next/link";
import { MasterAvatar } from "@/components/MasterCard";
import { NoVotesYet } from "@/components/tournament/EmptyStates";
import { Card, PageHeader } from "@/components/ui/Card";
import { LockGate } from "@/components/ui/LockGate";
import { FULL_UNLOCK_AFTER_H, USE_MOCK_DATA } from "@/config";
import { formatCompact, shortAddress } from "@/lib/format";
import { getMasters } from "@/lib/registry";
import { getLeaderboard } from "@/lib/tournament";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard" };

const th = "sticky top-0 bg-milk/80 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-fern backdrop-blur";
const td = "px-3 py-3.5";

function Rank({ n }: { n: number }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-semibold ${
        n === 1 ? "bg-[linear-gradient(135deg,#ffe58a,#f2b705)] text-soil" : "border border-line-strong text-soil"
      }`}
    >
      {n}
    </span>
  );
}

export default async function LeaderboardPage() {
  const masters = await getMasters();
  const name = new Map((masters.data ?? []).map((m) => [m.tokenAddress, m.name]));
  const board = await getLeaderboard();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Leaderboard"
        title="Who's leading this round"
        intro={
          <>
            Pitches are ranked by the voting power behind them; ties go to the earliest submission. Each wallet gets one vote
            per round, and the first vote is final.{" "}
            <Link href="/docs/voting" className="link">
              How voting works
            </Link>
          </>
        }
      />

      <LockGate
        feature="votingOpen"
        title="The leaderboard opens in"
        description={`The leaderboard unlocks ${FULL_UNLOCK_AFTER_H} hours after go-live, and fills as the Crowd votes.${USE_MOCK_DATA ? " Here's a preview of how it will look." : ""}`}
        minHeight="30rem"
      >
        {board.data && board.data.pitches.length > 0 ? (
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <Card title="Top pitches">
              <div className="-mx-3 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-line-strong">
                      <th className={th} scope="col">Rank</th>
                      <th className={th} scope="col">Pitch</th>
                      <th className={`${th} text-right`} scope="col">Votes</th>
                      <th className={`${th} text-right`} scope="col">Voting power</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.data.pitches.map((p) => (
                      <tr key={p.id} className={`border-b border-line transition-colors last:border-b-0 hover:bg-wash ${p.rank <= 3 ? `rank-${p.rank}` : ""}`}>
                        <td className={td}>
                          <Rank n={p.rank} />
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <MasterAvatar m={{ name: p.fighter, ticker: p.ticker ?? "", logoUrl: p.logoUrl ?? null }} size="sm" />
                            <div className="min-w-0">
                              <p className="font-semibold text-soil">{p.title}</p>
                              <p className="text-xs text-soil/70">
                                {p.fighter} · {p.masterToken ? `for ${name.get(p.masterToken) ?? "a Master"}` : "open pitch"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={`${td} text-right font-mono tabular-nums text-soil`}>{formatCompact(p.votes)}</td>
                        <td className={`${td} text-right font-mono font-semibold tabular-nums text-grass`}>{formatCompact(p.votingPower)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Top voters">
              <div className="-mx-3 overflow-x-auto">
                <table className="w-full min-w-[22rem] text-sm">
                  <thead>
                    <tr className="border-b border-line-strong">
                      <th className={th} scope="col">Rank</th>
                      <th className={th} scope="col">Wallet</th>
                      <th className={`${th} text-right`} scope="col">Power</th>
                      <th className={`${th} text-right`} scope="col">Winners backed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.data.voters.map((v) => (
                      <tr key={v.wallet} className={`border-b border-line transition-colors last:border-b-0 hover:bg-wash ${v.rank <= 3 ? `rank-${v.rank}` : ""}`}>
                        <td className={td}>
                          <Rank n={v.rank} />
                        </td>
                        <td className={`${td} font-mono text-xs text-soil`}>{shortAddress(v.wallet)}</td>
                        <td className={`${td} text-right font-mono font-semibold tabular-nums text-grass`}>{formatCompact(v.votingPower)}</td>
                        <td className={`${td} text-right font-mono tabular-nums text-soil`}>{v.backedWinners}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <NoVotesYet />
        )}
      </LockGate>
    </div>
  );
}
