import { PageHeader } from "@/components/ui/Card";

/** Date of the latest Terms and Privacy text. Update it whenever either page changes. */
const LEGAL_UPDATED = "3 October 2026";

/** Shared shell for the Terms and Privacy drafts. */
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: { h: string; p: string }[] }) {
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Legal" title={title} intro={intro} />
      <p className="rounded-xl mb-10 border border-line-strong bg-oat px-4 py-3 text-sm text-soil">
        <span className="font-semibold text-grass">Draft:</span> this page has not had a legal review yet. Last updated {LEGAL_UPDATED}.
      </p>
      <div className="prose-field">
        {sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
