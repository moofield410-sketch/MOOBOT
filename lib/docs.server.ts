import { readFileSync } from "node:fs";
import { join } from "node:path";
import { docVars } from "@/lib/doc-vars";
import { DOCS, docBySlug, indexDoc, renderDocTemplate, type DocIndexEntry } from "@/lib/docs";

const DOCS_DIR = join(process.cwd(), "content", "docs");

/** The markdown as written, with {{NAME}} placeholders and status tags. */
export function readRawDoc(slug: string): string | null {
  if (!docBySlug(slug)) return null;
  return readFileSync(join(DOCS_DIR, `${slug}.md`), "utf8");
}

/** The markdown with every number filled in from config.ts and the real code. */
export function readDoc(slug: string): string | null {
  const raw = readRawDoc(slug);
  return raw === null ? null : renderDocTemplate(raw, docVars());
}

let index: DocIndexEntry[] | null = null;

export function docsIndex(): DocIndexEntry[] {
  index ??= DOCS.flatMap((page) => indexDoc(page, readDoc(page.slug) ?? ""));
  return index;
}
