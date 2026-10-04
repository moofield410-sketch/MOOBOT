import { XEmbeds } from "@/components/home/XEmbeds";
import { SectionHeading } from "@/components/ui/Card";
import { XIcon } from "@/components/ui/Icons";
import { getXFeed, type XPost, type XProfile } from "@/lib/x-feed";
import { formatCompact, formatUpdated } from "@/lib/format";

/**
 * "From X": the official account's latest posts on the home page. Server-rendered in the site's
 * own style (no X script, no tracking) when X_BEARER_TOKEN is set; otherwise featured posts via
 * X's widget, or a follow card. See X_FEED in config.ts.
 */

function postTime(iso: string | null, now: number): { label: string; full: string } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  const full = new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  if (mins < 60) return { label: `${Math.max(1, mins)}m`, full };
  if (mins < 24 * 60) return { label: `${Math.round(mins / 60)}h`, full };
  return { label: new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), full };
}

function Metric({ label, value, d }: { label: string; value: number; d: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
      <span className="tabular-nums">{formatCompact(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const ICONS = {
  reply: "M4 5h16v10H9l-5 4V5Z",
  repost: "M7 7h10l-3-3M17 17H7l3 3M17 7v5M7 17v-5",
  like: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
};

function PostCard({ post, profile, now }: { post: XPost; profile: XProfile; now: number }) {
  const time = postTime(post.createdAt, now);
  return (
    <article className="card card-hover relative flex flex-col p-5">
      <header className="flex items-center gap-3">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar, already checked (https only)
          <img src={profile.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full border border-line object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-oat font-display font-semibold text-soil">
            {profile.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex items-center gap-1 truncate font-semibold text-soil">
            {profile.name}
            {profile.verified && (
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-sky" aria-label="Verified account" role="img">
                <path fill="currentColor" d="m12 2 2.4 2.1 3.2-.3.9 3 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3 3.2.3L12 2Z" />
                <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </p>
          <p className="truncate text-sm text-fern">
            @{profile.username}
            {time && (
              <>
                {" · "}
                <time dateTime={post.createdAt ?? undefined} title={time.full}>
                  {time.label}
                </time>
              </>
            )}
          </p>
        </div>
        <XIcon className="h-4 w-4 shrink-0 text-soil" />
      </header>

      <p className="mt-4 flex-1 whitespace-pre-line break-words text-[15px] leading-relaxed text-soil">
        {post.segments.map((s, i) =>
          s.type === "text" ? (
            <span key={i}>{s.value}</span>
          ) : (
            <a key={i} href={s.href} target="_blank" rel="noopener noreferrer nofollow" className="relative z-10 text-sky hover:underline">
              {s.value}
            </a>
          ),
        )}
      </p>

      {post.media && (
        // eslint-disable-next-line @next/next/no-img-element -- remote media from X, already checked (https only)
        <img
          src={post.media.url}
          alt={post.media.alt ?? ""}
          width={post.media.width ?? undefined}
          height={post.media.height ?? undefined}
          loading="lazy"
          className="mt-4 aspect-video w-full rounded-2xl border border-line object-cover"
        />
      )}

      {post.metrics && (
        <footer className="mt-4 flex items-center gap-5 border-t border-line pt-3 text-sm text-fern">
          <Metric label="Replies" value={post.metrics.replies} d={ICONS.reply} />
          <Metric label="Reposts" value={post.metrics.reposts} d={ICONS.repost} />
          <Metric label="Likes" value={post.metrics.likes} d={ICONS.like} />
        </footer>
      )}

      {/* The whole card opens the post; links inside the text sit above this layer. */}
      <a href={post.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 rounded-3xl" aria-label={`Open this post on X${time ? `, ${time.full}` : ""}`} />
    </article>
  );
}

export async function XFeed() {
  const feed = await getXFeed();
  const now = Date.now();

  const follow =
    feed.mode === "off" ? null : (
      <a href={feed.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
        <XIcon /> Follow @{feed.handle}
      </a>
    );

  return (
    <section aria-labelledby="from-x" data-reveal>
      <SectionHeading
        id="from-x"
        eyebrow="Official updates"
        title="From X"
        intro={feed.mode === "off" ? undefined : `The latest from @${feed.handle}: launch news, round results and what MooBot is up to.`}
        action={feed.mode === "live" || feed.mode === "featured" ? follow : undefined}
      />

      {feed.mode === "live" && (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
            {feed.posts.map((p) => (
              <PostCard key={p.id} post={p} profile={feed.profile} now={now} />
            ))}
          </div>
          <p className="mt-4 font-mono text-[11px] text-fern">
            {formatUpdated(feed.updatedAt)}
            {feed.stale && " · X couldn't be reached, showing the latest we have"}
          </p>
        </>
      )}

      {feed.mode === "featured" && <XEmbeds urls={feed.postUrls} />}

      {(feed.mode === "follow" || feed.mode === "off") && (
        <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-soil text-milk">
            <XIcon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="font-display text-lg font-semibold text-soil">
              {feed.mode === "off" ? `Our X account is coming soon` : `Follow @${feed.handle} for the latest`}
            </p>
            <p className="mt-1 text-sm text-fern">
              {feed.mode === "off"
                ? "Official posts will appear here. Until then, only trust links from this site."
                : "Launch news, round results and MooBot's updates, as they happen."}
            </p>
          </div>
          {follow}
        </div>
      )}
    </section>
  );
}
