import { MasterCard } from "@/components/MasterCard";
import type { Master } from "@/lib/types";

/** Below this many cards the row can't fill a wide screen, so it doesn't scroll by itself. */
const MARQUEE_MIN = 5;

/**
 * A slow, infinite, pause-on-hover marquee of MasterCards. The track is duplicated for a seamless
 * loop; the copy is hidden from screen readers and not focusable. With reduced motion the row
 * stops and scrolls sideways instead. A short list is a plain row you can swipe, so a single card
 * never drifts across an empty strip.
 */
export function MastersMarquee({ masters }: { masters: Master[] }) {
  const row = (copy: boolean) =>
    masters.map((m) => (
      <li key={`${copy ? "copy-" : ""}${m.tokenAddress}`} className="w-72 shrink-0 snap-start">
        <MasterCard m={m} eager />
      </li>
    ));

  if (masters.length < MARQUEE_MIN) {
    return <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto overscroll-x-contain px-4 py-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">{row(false)}</ul>;
  }

  return (
    <div className="marquee -mx-4 px-4 py-2 sm:-mx-6 sm:px-6">
      <div className="marquee-track">
        <ul className="flex gap-5">{row(false)}</ul>
        <ul aria-hidden inert className="flex gap-5">
          {row(true)}
        </ul>
      </div>
    </div>
  );
}
