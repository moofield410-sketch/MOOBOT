import Link from "next/link";
import { EmptyState } from "@/components/ui/Card";

/** Shown once the Tournament is open but nobody has pitched yet. Submission itself comes later. */
export function NoPitchesYet({ title = "No pitches yet, be the first", plain = false }: { title?: string; plain?: boolean }) {
  return (
    <EmptyState
      title={title}
      plain={plain}
      action={
        <Link href="/docs/pitching" className="btn-primary">
          Be the first to pitch
        </Link>
      }
    >
      <p>Pitch submission opens soon.</p>
    </EmptyState>
  );
}

export function NoTendersYet() {
  return (
    <EmptyState title="No tenders yet" mascot="sleeping">
      <p>Tenders are on the way: Masters will be able to post requests for Fighters here.</p>
    </EmptyState>
  );
}

export function NoRoundsYet({ firstRoundEnds }: { firstRoundEnds: string }) {
  return (
    <EmptyState title="No rounds finished yet" mascot="sleeping">
      <p>{`Round 1 ends ${firstRoundEnds}.`}</p>
    </EmptyState>
  );
}

export function NoVotesYet() {
  return (
    <EmptyState title="No votes yet">
      <p>Rankings will appear here once vote submission ships and the Crowd starts voting on pitches.</p>
    </EmptyState>
  );
}
