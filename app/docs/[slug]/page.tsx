import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/docs/Markdown";
import { DOCS, docBySlug, extractHeadings } from "@/lib/docs";
import { readDoc } from "@/lib/docs.server";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = docBySlug(slug);
  return page ? { title: page.title, description: page.description } : {};
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const page = docBySlug(slug);
  const source = readDoc(slug);
  if (!page || source === null) notFound();

  const headings = extractHeadings(source).filter((h) => h.level === 2);
  const i = DOCS.findIndex((d) => d.slug === slug);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_13rem]">
      <article className="min-w-0 max-w-3xl">
        <p className="eyebrow mb-2">Docs</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-soil sm:text-5xl">{page.title}</h1>
        <p className="mt-3 text-lg text-fern">{page.description}</p>
        <div className="mt-8">
          <Markdown source={source} />
        </div>

        <nav aria-label="Docs pages" className="mt-14 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="card card-hover p-4 no-underline">
              <p className="text-xs text-soil/60">Previous</p>
              <p className="font-semibold text-soil">{prev.title}</p>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="card card-hover p-4 text-right no-underline">
              <p className="text-xs text-soil/60">Next</p>
              <p className="font-semibold text-soil">{next.title}</p>
            </Link>
          )}
        </nav>
      </article>

      {headings.length > 1 && (
        <aside className="hidden xl:block">
          <div className="card sticky top-24 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-fern">On this page</p>
            <ul className="space-y-2 border-l border-line">
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="-ml-px block border-l border-transparent pl-3 text-sm text-soil/75 no-underline hover:border-grass hover:text-grass">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
