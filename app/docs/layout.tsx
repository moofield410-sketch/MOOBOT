import { DocsNav } from "@/components/docs/DocsNav";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { OfficialMooBotCard } from "@/components/moobot/OfficialMooBotCard";
import { XIcon } from "@/components/ui/Icons";
import { DISCLAIMER, SOCIAL } from "@/config";
import { DOCS } from "@/lib/docs";
import { docsIndex } from "@/lib/docs.server";

/** The contract card, the X link and the disclaimer: in the sidebar on desktop, after the page on phones. */
function DocsExtras({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="border-t border-line pt-4">
        <OfficialMooBotCard compact />
      </div>
      <div className="mt-5 space-y-3 border-t border-line pt-4">
        {SOCIAL.x && (
          <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-2 text-sm text-soil/80 no-underline hover:text-grass">
            <XIcon /> {`Follow ${SOCIAL.xHandle} on X`}
          </a>
        )}
        <p className="text-xs leading-relaxed text-soil/65">{DISCLAIMER}</p>
      </div>
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow">Documentation</p>
        <DocsSearch index={docsIndex()} />
        <DocsNav pages={DOCS} />
        <DocsExtras className="hidden lg:block" />
      </aside>
      <div className="min-w-0">{children}</div>
      <DocsExtras className="lg:hidden" />
    </div>
  );
}
