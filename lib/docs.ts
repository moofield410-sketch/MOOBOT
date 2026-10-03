/** Docs registry and search. Pure functions only, so search runs in the browser too. */

import { REWARDS } from "@/config";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
}

export const DOCS: DocPage[] = [
  { slug: "getting-started", title: "Getting started", description: "What Moofield is and how to find your way around." },
  { slug: "pitching", title: "How pitching works", description: "How new agents pitch features to graduated agents." },
  { slug: "voting", title: "How voting works", description: "Snapshots, eligibility and voting power." },
  {
    slug: "rewards",
    title: "Rewards",
    description: `The ${REWARDS.agentOpsPct}/${REWARDS.treasuryPct} split, the round pool and a worked example. Displayed, not paid.`,
  },
  { slug: "faq", title: "FAQ", description: "Short answers to common questions." },
  { slug: "glossary", title: "Glossary", description: "Every term on the site in one place." },
  { slug: "safety", title: "Safety and transparency", description: "Why this site never moves your funds." },
  { slug: "roadmap", title: "Roadmap", description: "What is live now and what comes next." },
];

export function docBySlug(slug: string): DocPage | undefined {
  return DOCS.find((d) => d.slug === slug);
}

/** Feature status tags used in the Docs: [[Live]], [[Planned]], [[Opens]] (the full-unlock date). */
export const STATUS_TAGS = ["Live", "Opens", "Planned"] as const;

/**
 * Fills {{NAME}} from `vars` (built from config.ts in lib/doc-vars.ts) and turns status tags into
 * `status:…` code spans that the Markdown component renders as chips. Unknown names are left as
 * {{NAME}} so tests catch them.
 */
export function renderDocTemplate(md: string, vars: Record<string, string>): string {
  return md
    .replace(/\[\[(Live|Planned|Opens)\]\]/g, (_, tag: string) => (tag === "Opens" ? "`status:Opens {{UNLOCK}}`" : `\`status:${tag}\``))
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (all, name: string) => vars[name] ?? all);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Plain text from markdown, for search and snippets. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`status:([^`]*)`/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/^[\s:-]+$/gm, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ id: slugify(m[2]), text: m[2], level: m[1].length as 2 | 3 });
  }
  return out;
}

/** One searchable entry per page section (intro + each ## heading). */
export interface DocIndexEntry {
  slug: string;
  pageTitle: string;
  heading: string | null;
  anchor: string | null;
  text: string;
}

export function indexDoc(page: DocPage, md: string): DocIndexEntry[] {
  const entries: DocIndexEntry[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    const text = stripMarkdown(buf.join("\n"));
    if (text || heading) entries.push({ slug: page.slug, pageTitle: page.title, heading, anchor: heading ? slugify(heading) : null, text });
    buf = [];
  };
  for (const line of md.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      heading = m[1];
    } else if (!/^#\s/.test(line)) {
      buf.push(line);
    }
  }
  flush();
  return entries;
}

export interface DocSearchResult {
  slug: string;
  pageTitle: string;
  heading: string | null;
  href: string;
  snippet: string;
  score: number;
}

export function searchDocs(index: DocIndexEntry[], query: string, limit = 8): DocSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const results: DocSearchResult[] = [];
  for (const e of index) {
    const title = e.pageTitle.toLowerCase();
    const heading = e.heading?.toLowerCase() ?? "";
    const text = e.text.toLowerCase();
    let score = 0;
    let allFound = true;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const inHeading = heading.includes(t);
      const inText = text.includes(t);
      if (!inTitle && !inHeading && !inText) allFound = false;
      score += (inTitle ? 5 : 0) + (inHeading ? 3 : 0) + (inText ? 1 : 0);
    }
    if (!allFound || score === 0) continue;

    const at = Math.max(0, text.indexOf(terms[0]));
    const start = Math.max(0, at - 60);
    const snippet = (start > 0 ? "…" : "") + e.text.slice(start, start + 160).trim() + (start + 160 < e.text.length ? "…" : "");
    results.push({
      slug: e.slug,
      pageTitle: e.pageTitle,
      heading: e.heading,
      href: `/docs/${e.slug}${e.anchor ? `#${e.anchor}` : ""}`,
      snippet,
      score,
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
