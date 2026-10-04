import { MooBotMascot } from "@/components/MooBotMascot";
import { AURA_RING } from "@/components/moobot/aura";
import { Card } from "@/components/ui/Card";
import { HOLDER_AURA_TIERS } from "@/config";
import type { TokenBalance } from "@/lib/types";

const whole = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Every holder aura tier, the one this wallet has now, and how far it is to the next. Cosmetic only:
 * it changes how the floating MooBot looks, never voting power or rewards. Reads the same balance
 * as the tiles above, so it fills in by itself once $MOOBOT is confirmed on Orbio.
 */
export function HolderAuraPreview({ moobot }: { moobot: TokenBalance | undefined }) {
  const balance = moobot?.status === "ok" && moobot.formatted !== null ? Number(moobot.formatted) : null;
  const currentIndex = balance === null ? -1 : HOLDER_AURA_TIERS.findLastIndex((t) => balance >= t.minMooBot);
  const next = balance === null ? null : (HOLDER_AURA_TIERS[currentIndex + 1] ?? null);
  const prevMin = currentIndex >= 0 ? HOLDER_AURA_TIERS[currentIndex].minMooBot : 0;
  const pct = next && balance !== null ? Math.min(100, Math.max(0, ((balance - prevMin) / (next.minMooBot - prevMin)) * 100)) : 100;

  return (
    <Card eyebrow="Holder aura" title="How your MooBot glows">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HOLDER_AURA_TIERS.map((t, i) => {
          const reached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li
              key={t.name}
              className={`flex flex-col items-center rounded-2xl border p-4 text-center ${isCurrent ? "border-grass/40 bg-grass/5" : "border-line bg-milk"}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              <span className={`rounded-full bg-milk p-1 ${AURA_RING[t.name] ?? ""} ${reached || balance === null ? "" : "opacity-45 grayscale"}`}>
                <MooBotMascot variant="head" size={44} state={isCurrent ? "happy" : "idle"} decorative />
              </span>
              <p className="mt-3 font-display font-semibold text-soil">{t.name}</p>
              <p className="font-mono text-xs text-fern">{whole(t.minMooBot)}+</p>
              {isCurrent && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-grass">Yours</p>}
            </li>
          );
        })}
      </ol>

      <div className="mt-5">
        {balance === null ? (
          <p className="text-sm text-fern">
            {moobot?.status === "not-launched"
              ? "Your aura appears here by itself once $MOOBOT is confirmed on Orbio."
              : "Connect a wallet to see your aura."}
          </p>
        ) : next ? (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="text-soil/85">
                {whole(Math.max(0, next.minMooBot - balance))} more $MOOBOT to <span className="font-semibold">{next.name}</span>
              </p>
              <p className="font-mono tabular-nums text-fern">{pct.toFixed(0)}%</p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`Progress to ${next.name}`}>
              <div className="h-full rounded-full bg-chart" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-grass">Top tier reached: Radiant.</p>
        )}
        <p className="mt-3 text-xs text-fern">Cosmetic only. It changes how MooBot looks, never voting power or rewards.</p>
      </div>
    </Card>
  );
}
