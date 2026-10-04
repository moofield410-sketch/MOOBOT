import { XTimeline } from "@/components/home/XTimeline";
import { SectionHeading } from "@/components/ui/Card";
import { XIcon } from "@/components/ui/Icons";
import { MooBotMascot } from "@/components/MooBotMascot";
import { SOCIAL } from "@/config";

/**
 * "From X": the official account's timeline, embedded with X's own free widget (no X API, no
 * keys). It updates by itself whenever a new post goes up. If X won't show the timeline (it
 * sometimes asks visitors to log in), XTimeline keeps a clean follow card instead.
 */
export function XFeed() {
  const url = SOCIAL.x;
  const handle = SOCIAL.xHandle.replace(/^@/, "");

  return (
    <section aria-labelledby="from-x" data-reveal>
      <SectionHeading id="from-x" eyebrow="Official updates" title="From X" />

      {url ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="card p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-line bg-milk">
                <MooBotMascot variant="head" size={46} decorative />
                <span className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-milk bg-soil text-milk">
                  <XIcon className="h-3.5 w-3.5" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-soil">Moofield</p>
                <p className="font-mono text-sm text-fern">@{handle}</p>
              </div>
            </div>
            <p className="mt-5 text-fern">
              Launch news, round results and what MooBot is up to. This is the only official Moofield account on X.
            </p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
              <XIcon /> Follow @{handle}
            </a>
          </div>

          <XTimeline url={url} handle={handle} />
        </div>
      ) : (
        <div className="card p-6 sm:p-8">
          <p className="font-display text-lg font-semibold text-soil">Our X account is coming soon</p>
          <p className="mt-1 text-sm text-fern">Official posts will appear here. Until then, only trust links from this site.</p>
        </div>
      )}
    </section>
  );
}
