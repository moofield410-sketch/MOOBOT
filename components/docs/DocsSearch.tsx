"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/Icons";
import { searchDocs, type DocIndexEntry } from "@/lib/docs";

/** Docs search. Press "/" to focus; arrow keys move through results; Enter opens one. */
export function DocsSearch({ index }: { index: DocIndexEntry[] }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const listId = useId();

  const results = useMemo(() => searchDocs(index, q), [index, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const show = open && q.trim().length > 1;

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Search the docs</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-soil/60" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && results[active] ? `${listId}-${active}` : undefined}
          value={q}
          placeholder="Search the docs"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!show) return;
            if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
            else if (e.key === "Enter" && results[active]) {
              router.push(results[active].href);
              setOpen(false);
            } else if (e.key === "Escape") setOpen(false);
            else return;
            e.preventDefault();
          }}
          className="rounded-xl h-11 w-full border border-line bg-milk pl-9 pr-10 text-sm text-soil placeholder:text-soil/50 focus:border-line-strong"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-sm border border-line px-1.5 text-xs text-soil/60 sm:block">
          /
        </kbd>
      </label>

      {show && (
        <div className="card absolute inset-x-0 top-full z-30 mt-2 bg-milk p-1.5 shadow-2xl shadow-soil/20">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-96 overflow-y-auto">
              {results.map((r, i) => (
                <li key={r.href + i} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={`block px-3 py-2.5 no-underline ${i === active ? "bg-milk" : ""}`}
                  >
                    <p className="text-sm font-semibold text-soil">
                      {r.pageTitle}
                      {r.heading && <span className="font-normal text-soil/70"> › {r.heading}</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-soil/70">{r.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-soil/75">No results for &ldquo;{q}&rdquo;.</p>
          )}
        </div>
      )}
    </div>
  );
}
