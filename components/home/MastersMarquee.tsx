import { MasterCard } from "@/components/MasterCard";
import type { Master } from "@/lib/types";

/**
 * A slow, infinite, pause-on-hover marquee of MasterCards. The track is duplicated for a seamless
 * loop; the copy is hidden from screen readers and not focusable. With reduced motion the row
 * stops and scrolls sideways instead.
 */
export function MastersMarquee({ masters }: { masters: Master[] }) {
  const row = (copy: boolean) =>
    masters.map((m) => (
      <li key={`${copy ? "copy-" : ""}${m.tokenAddress}`} className="w-72 shrink-0">
        <MasterCard m={m} />
      </li>
    ));

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
