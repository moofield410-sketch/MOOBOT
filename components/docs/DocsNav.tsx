"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DocPage } from "@/lib/docs";

/** Left sidebar on desktop, a select on mobile. */
export function DocsNav({ pages }: { pages: DocPage[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = pages.find((p) => pathname === `/docs/${p.slug}`)?.slug ?? "";

  return (
    <>
      <label className="block lg:hidden">
        <span className="sr-only">Docs page</span>
        <select
          value={current}
          onChange={(e) => router.push(e.target.value ? `/docs/${e.target.value}` : "/docs")}
          className="rounded-xl h-11 w-full border border-line bg-milk px-3 text-sm text-soil"
        >
          <option value="">Docs overview</option>
          {pages.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <nav aria-label="Docs" className="hidden lg:block">
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/docs"
              aria-current={pathname === "/docs" ? "page" : undefined}
              className={`block border-l-2 px-3 py-2 text-sm no-underline ${
                pathname === "/docs" ? "border-grass font-semibold text-grass" : "border-transparent text-soil/80 hover:text-soil"
              }`}
            >
              Overview
            </Link>
          </li>
          {pages.map((p) => {
            const active = current === p.slug;
            return (
              <li key={p.slug}>
                <Link
                  href={`/docs/${p.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`block border-l-2 px-3 py-2 text-sm no-underline ${
                    active ? "border-grass font-semibold text-grass" : "border-transparent text-soil/80 hover:border-line-strong hover:text-soil"
                  }`}
                >
                  {p.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
