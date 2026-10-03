import { MooBotMascot, type MascotState } from "@/components/MooBotMascot";
import { formatUpdated } from "@/lib/format";
import type { DataEnvelope } from "@/lib/types";

type Meta = Pick<DataEnvelope<unknown>, "updatedAt" | "stale" | "error">;

/** The one card style used everywhere: soft glass, a hairline border, rounded corners, generous padding. */
export function Card({
  title,
  eyebrow,
  action,
  meta,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
  /** When set, shows "Updated …" and a friendly stale warning (acceptance criterion 8). */
  meta?: Meta;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex flex-col p-6 sm:p-7 ${className}`}>
      {(title || eyebrow || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            {title && <h2 className="font-display text-lg font-semibold text-soil">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {meta?.stale && <StaleNotice error={meta.error} />}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
      {meta && <p className="mt-5 font-mono text-[11px] text-fern">{formatUpdated(meta.updatedAt)}</p>}
    </section>
  );
}

export function StaleNotice({ error }: { error?: string }) {
  return (
    <p role="status" className="mb-4 rounded-xl border border-line border-l-2 border-l-wheat bg-oat px-3 py-2 text-sm text-soil">
      Some of this data may be delayed. We&apos;re showing the latest we have.
      {error && <span className="sr-only"> ({error})</span>}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  action,
  id,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 id={id} className="scroll-mt-24 font-display text-3xl font-semibold text-soil sm:text-4xl">
          {title}
        </h2>
        {intro && <p className="mt-3 text-fern">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="animate-lift mb-12 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-soil sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-base text-fern sm:text-lg">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

/** Real, empty data: says so plainly, with an optional next step and a friendly MooBot. */
export function EmptyState({
  title,
  children,
  action,
  plain = false,
  mascot = "idle",
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Without the card frame, for use inside another card. */
  plain?: boolean;
  mascot?: Extract<MascotState, "idle" | "sleeping"> | null;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${plain ? "py-6" : "card p-10"}`}>
      {mascot && <MooBotMascot state={mascot} size={plain ? 72 : 96} decorative className="mb-4" />}
      <p className="font-display text-lg font-semibold text-soil">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-fern">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ComingSoon({ title = "Coming soon", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <MooBotMascot state="sleeping" size={80} decorative className="mb-4" />
      <p className="font-display text-lg font-semibold text-grass">{title}</p>
      {children && <p className="mt-2 max-w-md text-sm text-fern">{children}</p>}
    </div>
  );
}

/** Loading placeholder: a small thinking MooBot with shimmer bars. */
export function Thinking({ label = "Loading…", bars = 2 }: { label?: string; bars?: number }) {
  return (
    <div className="flex items-center gap-4" aria-busy="true">
      <MooBotMascot state="thinking" size={44} decorative />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-fern">{label}</p>
        {Array.from({ length: bars }, (_, i) => (
          <div key={i} className="skeleton h-2.5" style={{ width: `${88 - i * 26}%` }} />
        ))}
      </div>
    </div>
  );
}
