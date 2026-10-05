import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { OpensChip } from "@/components/docs/OpensChip";
import { slugify } from "@/lib/docs";

function text(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(text).join("");
  if (children && typeof children === "object" && "props" in children) {
    return text((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

const components: Components = {
  // The page title is rendered by the page itself; skip the markdown H1.
  h1: () => null,
  h2: ({ children }) => <h2 id={slugify(text(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={slugify(text(children))}>{children}</h3>,
  a: ({ href = "", children }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href}>{children}</Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  // Feature status tags ([[Live]] / [[Opens]] / [[Planned]] in the markdown, see lib/docs.ts).
  code: ({ children }) => {
    const t = text(children);
    if (!t.startsWith("status:")) return <code>{children}</code>;
    const label = t.slice("status:".length);
    if (label.startsWith("Opens")) return <OpensChip label={label} />;
    const tone = label === "Live" ? "border-wheat text-wheat" : label === "Planned" ? "border-line-strong text-soil/80" : "border-grass text-grass";
    return <span className={`chip mr-1.5 align-middle text-[11px] font-semibold not-italic ${tone}`}>{label}</span>;
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

/** Renders trusted docs markdown from content/docs. No raw HTML is allowed. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-field">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
