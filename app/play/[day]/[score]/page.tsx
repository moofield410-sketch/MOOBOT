import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MooBotMascot } from "@/components/MooBotMascot";
import { SprigDivider } from "@/components/ui/Nature";
import { dailyFieldId, parseShare } from "@/lib/bloom-pop";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ day: string; score: string }> };

/** Shared Bloom Pop scores land here. The preview image is the score card (opengraph-image.tsx). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day, score } = await params;
  const s = parseShare(day, score);
  if (!s) return { title: "Bloom Pop" };
  const title = `${s.score.toLocaleString("en-US")} on the Bloom Pop field of ${formatDate(`${s.day}T00:00:00Z`)}`;
  return { title, description: "Help MooBot plant the Field. A new field every day, the same for everyone.", openGraph: { title }, twitter: { card: "summary_large_image", title } };
}

export default async function SharedScorePage({ params }: Props) {
  const { day, score } = await params;
  const s = parseShare(day, score);
  if (!s) notFound();
  const today = s.day === dailyFieldId(Date.now());

  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <div className="card relative overflow-hidden px-6 pb-10 pt-12 sm:px-10">
        <SprigDivider className="mb-6" />
        <p className="eyebrow mx-auto mb-3 w-max">Bloom Pop · field of {formatDate(`${s.day}T00:00:00Z`)}</p>
        <p className="font-mono text-6xl font-semibold tabular-nums text-moss sm:text-7xl">{s.score.toLocaleString("en-US")}</p>
        <p className="mt-3 text-fern">
          {today ? "Someone planted this score on today's field. Your turn." : "That field has wilted, but a new one grows every day."}
        </p>
        <MooBotMascot state="happy" size={150} decorative className="mx-auto mt-6" />
        <Link href="/#bloom-pop" className="btn-primary mt-6 px-7 py-3.5 text-base">
          Play today&apos;s field
        </Link>
        <p className="mt-5 text-xs text-fern">Just for fun. Scores are self-reported, stay in your browser and have no value.</p>
      </div>
    </div>
  );
}
