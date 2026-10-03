import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Card";
import { DOCS } from "@/lib/docs";

export const metadata: Metadata = { title: "Docs" };

export default function DocsIndexPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Docs"
        title="How Moofield works"
        intro="Plain-language guides to pitching, voting, rewards and safety. Start with Getting started if you're new."
      />
      <ul className="grid gap-5 sm:grid-cols-2">
        {DOCS.map((d) => (
          <li key={d.slug}>
            <Link href={`/docs/${d.slug}`} className="card card-hover group flex h-full flex-col p-6 no-underline">
              <p className="text-lg font-bold text-soil group-hover:text-grass">{d.title}</p>
              <p className="mt-2 text-sm text-soil/80">{d.description}</p>
              <p className="mt-4 text-sm font-semibold text-grass">Read →</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
