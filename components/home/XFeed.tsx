import { SectionHeading } from "@/components/ui/Card";
import { XIcon } from "@/components/ui/Icons";
import { MooBotMascot } from "@/components/MooBotMascot";
import { SOCIAL } from "@/config";
import { getFeed, type FeedPost } from "@/lib/feed";
import { formatUtcDateTime } from "@/lib/format";

/**
 * "From X": the latest posts on the official account, drawn from the site's own record of what it
 * posted (lib/feed.ts), each linking to the post on X. No X API and no X widget, so it never asks
 * visitors to log in and never shows an empty frame.
 */

const KIND_LABEL: Record<string, string> = {
  news: "Ecosystem news",
  explainer: "Explainer",
  builder: "Builder log",
  spotlight: "Spotlight",
  tournament: "Tournament",
  bigpicture: "Big picture",
  mood: "Mood",
  poll: "Poll",
  launch: "Launch",
  board: "Bloom Pop",
  recap: "Daily recap",
  graduation: "Graduation",
};

/** "12 min ago", "3 h ago", or the date for anything older than a day. */
function when(at: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(at)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return formatUtcDateTime(at);
}

/** Cashtags and @handles in the brand colour, the rest as plain text. */
function PostText({ text }: { text: string }) {
  const parts = text.split(/(\$[A-Za-z][A-Za-z0-9_]*|@\w{1,15})/g);
  return (
    <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-soil">
      {parts.map((p, i) =>
        /^[$@]\w/.test(p) ? (
          <span key={i} className="font-semibold text-grass">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </p>
  );
}

function PostCard({ post, handle, now }: { post: FeedPost; handle: string; now: number }) {
  return (
    <li className="card card-hover flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-milk">
          <MooBotMascot variant="head" size={28} decorative />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-semibold text-soil">Moofield</p>
          <p className="font-mono text-xs text-fern">
            @{handle} · <time dateTime={post.at}>{when(post.at, now)}</time>
          </p>
        </div>
        {KIND_LABEL[post.kind] && <span className="shrink-0 rounded-full border border-line bg-wash px-2.5 py-0.5 text-[11px] font-semibold text-fern">{KIND_LABEL[post.kind]}</span>}
      </div>
      <div className="mt-4 flex-1">
        <PostText text={post.text} />
        {post.image && (
          // Our own images (the Bloom Pop board), served from this site.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image} alt="" loading="lazy" className="mt-3 w-full rounded-xl border border-line" />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="text-fern">{post.more > 0 ? `Thread · ${post.more + 1} posts` : ""}</span>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5 font-semibold">
          <XIcon className="h-3.5 w-3.5" /> View on X
        </a>
      </div>
    </li>
  );
}

export async function XFeed() {
  const url = SOCIAL.x;
  const handle = SOCIAL.xHandle.replace(/^@/, "");
  const posts = url ? await getFeed(6) : [];
  const now = Date.now();

  return (
    <section aria-labelledby="from-x" data-reveal>
      <SectionHeading id="from-x" eyebrow="Official updates" title="From X" />

      {url ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="card p-6 sm:p-8 lg:sticky lg:top-24">
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
              MooBot explains how Orbio works, covers every agent on the launchpad, calls the Tournament and answers the herd. This is the only official Moofield account on X.
            </p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
              <XIcon /> Follow @{handle}
            </a>
          </div>

          {posts.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {posts.map((p) => (
                <PostCard key={p.url} post={p} handle={handle} now={now} />
              ))}
            </ul>
          ) : (
            <div className="card flex min-h-[14rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <MooBotMascot variant="head" size={48} decorative />
              <p className="font-display text-lg font-semibold text-soil">MooBot&apos;s first posts are on the way</p>
              <p className="max-w-sm text-sm text-fern">New posts show up here as soon as they go out on X.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-1">
                Open @{handle}
              </a>
            </div>
          )}
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
